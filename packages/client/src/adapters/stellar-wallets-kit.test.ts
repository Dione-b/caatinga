import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authModal: vi.fn(),
  getAddress: vi.fn(),
  fetchAddress: vi.fn(),
  signTransaction: vi.fn(),
  setWallet: vi.fn(),
  refreshSupportedWallets: vi.fn(),
  disconnect: vi.fn(),
  init: vi.fn(),
  setNetwork: vi.fn(),
  state: { selectedModule: undefined as { productId: string } | undefined },
}));

vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: {
    init: mocks.init,
    setNetwork: mocks.setNetwork,
    setWallet: mocks.setWallet,
    authModal: mocks.authModal,
    getAddress: mocks.getAddress,
    fetchAddress: mocks.fetchAddress,
    signTransaction: mocks.signTransaction,
    refreshSupportedWallets: mocks.refreshSupportedWallets,
    disconnect: mocks.disconnect,
    // Mirrors the real kit: throws `{code: -3}` until a wallet is selected.
    get selectedModule() {
      if (!mocks.state.selectedModule) {
        throw { code: -3, message: "Please set the wallet first" };
      }
      return mocks.state.selectedModule;
    },
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  Networks: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015",
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => []),
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FREIGHTER_ID: "freighter",
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/hotwallet", () => ({
  HOTWALLET_ID: "hot-wallet",
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/wallet-connect", () => ({
  WalletConnectModule: vi.fn(),
}));

import {
  createStellarWalletsKitAdapter,
  resetStellarWalletsKitAdapterForTests,
} from "./stellar-wallets-kit.js";

describe("createStellarWalletsKitAdapter", () => {
  beforeEach(() => {
    resetStellarWalletsKitAdapterForTests();
    vi.clearAllMocks();
    mocks.state.selectedModule = undefined;
    mocks.getAddress.mockResolvedValue({ address: "GPUBLIC" });
    mocks.fetchAddress.mockResolvedValue({ address: "GFETCHED" });
    mocks.signTransaction.mockResolvedValue({ signedTxXdr: "AAAA_SIGNED" });
    mocks.refreshSupportedWallets.mockResolvedValue([
      { id: "freighter", name: "Freighter", isAvailable: true },
    ]);
    mocks.disconnect.mockResolvedValue(undefined);
  });

  it("initializes the kit on first adapter creation", () => {
    createStellarWalletsKitAdapter();

    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedWalletId: "freighter",
        modules: [],
      })
    );
  });

  it("fetches the public key from the kit address", async () => {
    const adapter = createStellarWalletsKitAdapter();

    const publicKey = await adapter.getPublicKey();

    expect(mocks.getAddress).toHaveBeenCalledTimes(1);
    expect(publicKey).toBe("GPUBLIC");
  });

  it("falls back to fetchAddress when getAddress reports no connected wallet", async () => {
    // Custom-modal flow: setWallet() is called but activeAddress is never
    // populated, so getAddress() rejects with SWK's plain-object error.
    mocks.getAddress.mockRejectedValue({ code: -1, message: "No wallet has been connected." });
    const adapter = createStellarWalletsKitAdapter();

    const publicKey = await adapter.getPublicKey();

    expect(mocks.fetchAddress).toHaveBeenCalledTimes(1);
    expect(publicKey).toBe("GFETCHED");
  });

  it("signs using the cached address and provided network passphrase", async () => {
    const adapter = createStellarWalletsKitAdapter();
    await adapter.getPublicKey();

    const signed = await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(mocks.signTransaction).toHaveBeenCalledWith("AAAA_UNSIGNED", {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: "GPUBLIC",
    });
    expect(signed).toBe("AAAA_SIGNED");
  });

  it("signs without an address before any connect", async () => {
    const adapter = createStellarWalletsKitAdapter();

    await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    expect(mocks.signTransaction).toHaveBeenCalledWith("AAAA_UNSIGNED", {
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
  });

  it("delegates wallet selection to the kit", () => {
    const adapter = createStellarWalletsKitAdapter();

    adapter.setWallet("freighter");

    expect(mocks.setWallet).toHaveBeenCalledWith("freighter");
  });

  it("reports undefined wallet id before any selection", () => {
    const adapter = createStellarWalletsKitAdapter();

    expect(adapter.getWalletId()).toBeUndefined();
  });

  it("reads the wallet id from the kit's selected module", () => {
    const adapter = createStellarWalletsKitAdapter();
    mocks.state.selectedModule = { productId: "freighter" };

    expect(adapter.getWalletId()).toBe("freighter");
  });

  it("opens the modal via authModal and resolves with the address", async () => {
    mocks.authModal.mockResolvedValue({ address: "GPUBLIC" });
    const adapter = createStellarWalletsKitAdapter();

    const resolvedAddress = await adapter.openModal();

    expect(mocks.authModal).toHaveBeenCalledTimes(1);
    expect(resolvedAddress).toBe("GPUBLIC");
  });

  it("rejects when the user closes the modal without selecting", async () => {
    const closeError = new Error("Modal closed");
    mocks.authModal.mockRejectedValue(closeError);
    const onClosed = vi.fn();
    const adapter = createStellarWalletsKitAdapter();

    await expect(adapter.openModal({ onClosed })).rejects.toBe(closeError);
    expect(onClosed).toHaveBeenCalledWith(closeError);
  });

  it("clears the cached address on disconnect", async () => {
    const adapter = createStellarWalletsKitAdapter();
    await adapter.getPublicKey();

    await adapter.disconnect();
    await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.signTransaction).toHaveBeenLastCalledWith("AAAA_UNSIGNED", {
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });
});
