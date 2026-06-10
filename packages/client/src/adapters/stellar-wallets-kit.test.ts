import { describe, expect, it, vi } from "vitest";

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: vi.fn(),
  WalletNetwork: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015"
  },
  allowAllModules: vi.fn(() => []),
  FREIGHTER_ID: "freighter"
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/walletconnect.module", () => ({
  WalletConnectAllowedMethods: { SIGN: "stellar_signXDR" },
  WalletConnectModule: vi.fn()
}));

import { createStellarWalletsKitAdapter } from "./stellar-wallets-kit.js";

function createKit() {
  return {
    setWallet: vi.fn(),
    getSupportedWallets: vi.fn(async () => [
      { id: "freighter", name: "Freighter", isAvailable: true }
    ]),
    getAddress: vi.fn(async () => ({ address: "GPUBLIC" })),
    signTransaction: vi.fn(async () => ({ signedTxXdr: "AAAA_SIGNED" })),
    openModal: vi.fn(),
    disconnect: vi.fn(async () => undefined)
  };
}

describe("createStellarWalletsKitAdapter", () => {
  it("fetches the public key from the kit address", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    const publicKey = await adapter.getPublicKey();

    expect(kit.getAddress).toHaveBeenCalledTimes(1);
    expect(publicKey).toBe("GPUBLIC");
  });

  it("signs using the cached address and provided network passphrase", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });
    await adapter.getPublicKey();

    const signed = await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015"
    });

    expect(kit.signTransaction).toHaveBeenCalledWith("AAAA_UNSIGNED", {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: "GPUBLIC"
    });
    expect(signed).toBe("AAAA_SIGNED");
  });

  it("signs without an address before any connect", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Public Global Stellar Network ; September 2015"
    });

    expect(kit.signTransaction).toHaveBeenCalledWith("AAAA_UNSIGNED", {
      networkPassphrase: "Public Global Stellar Network ; September 2015"
    });
  });

  it("delegates wallet selection to the kit", () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    adapter.setWallet("freighter");

    expect(kit.setWallet).toHaveBeenCalledWith("freighter");
  });

  it("opens the modal, selects the wallet, and resolves with the address", async () => {
    const kit = createKit();
    kit.openModal.mockImplementation(async ({ onWalletSelected }) => {
      onWalletSelected({ id: "xbull" } as never);
    });
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    const address = await adapter.openModal();

    expect(kit.setWallet).toHaveBeenCalledWith("xbull");
    expect(address).toBe("GPUBLIC");
  });

  it("rejects when the user closes the modal without selecting", async () => {
    const kit = createKit();
    const closeError = new Error("Modal closed");
    kit.openModal.mockImplementation(async ({ onClosed }) => {
      onClosed(closeError);
    });
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    await expect(adapter.openModal()).rejects.toBe(closeError);
  });

  it("clears the cached address on disconnect", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });
    await adapter.getPublicKey();

    await adapter.disconnect();
    await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015"
    });

    expect(kit.disconnect).toHaveBeenCalledTimes(1);
    expect(kit.signTransaction).toHaveBeenLastCalledWith("AAAA_UNSIGNED", {
      networkPassphrase: "Test SDF Network ; September 2015"
    });
  });
});
