import { describe, expect, it, vi } from "vitest";

vi.mock("stellar-wallets-kit", () => ({
  StellarWalletsKit: vi.fn(),
  WalletNetwork: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015"
  },
  WalletType: {
    ALBEDO: "ALBEDO",
    FREIGHTER: "FREIGHTER",
    RABET: "RABET",
    WALLET_CONNECT: "WALLET_CONNECT",
    XBULL: "XBULL"
  }
}));

import { WalletNetwork, WalletType } from "stellar-wallets-kit";
import { createStellarWalletsKitAdapter } from "./stellar-wallets-kit.js";

function createKit() {
  return {
    setWallet: vi.fn(async () => undefined),
    setNetwork: vi.fn(async () => undefined),
    getPublicKey: vi.fn(async () => "GPUBLIC"),
    sign: vi.fn(async () => ({ signedXDR: "AAAA_SIGNED" })),
    startWalletConnect: vi.fn(async () => undefined),
    connectWalletConnect: vi.fn(async () => undefined),
    getSessions: vi.fn(async () => [{ id: "session-1" }]),
    setSession: vi.fn(async () => undefined),
    onSessionDeleted: vi.fn()
  };
}

describe("createStellarWalletsKitAdapter", () => {
  it("delegates wallet selection and public key lookup to the kit", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    await adapter.setWallet(WalletType.FREIGHTER);
    const publicKey = await adapter.getPublicKey();

    expect(kit.setWallet).toHaveBeenCalledWith(WalletType.FREIGHTER);
    expect(publicKey).toBe("GPUBLIC");
  });

  it("sets testnet from the Caatinga network passphrase before signing", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });
    await adapter.getPublicKey();

    const signed = await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015"
    });

    expect(kit.setNetwork).toHaveBeenCalledWith(WalletNetwork.TESTNET);
    expect(kit.sign).toHaveBeenCalledWith({
      xdr: "AAAA_UNSIGNED",
      publicKey: "GPUBLIC"
    });
    expect(signed).toBe("AAAA_SIGNED");
  });

  it("sets public network from the Caatinga network passphrase before signing", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });

    await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Public Global Stellar Network ; September 2015"
    });

    expect(kit.setNetwork).toHaveBeenCalledWith(WalletNetwork.PUBLIC);
  });

  it("delegates WalletConnect lifecycle methods", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });
    const metadata = {
      name: "Caatinga",
      description: "Caatinga dApp",
      url: "https://example.com",
      icons: ["https://example.com/icon.png"],
      projectId: "project-id"
    };

    await adapter.startWalletConnect(metadata);
    await adapter.connectWalletConnect({ pairingTopic: "topic" });
    const sessions = await adapter.getWalletConnectSessions();
    await adapter.setWalletConnectSession("session-1");

    expect(kit.startWalletConnect).toHaveBeenCalledWith(metadata);
    expect(kit.connectWalletConnect).toHaveBeenCalledWith({ pairingTopic: "topic" });
    expect(sessions).toEqual([{ id: "session-1" }]);
    expect(kit.setSession).toHaveBeenCalledWith("session-1");
  });

  it("defers WalletConnect session deletion registration until WalletConnect starts", async () => {
    const kit = createKit();
    const adapter = createStellarWalletsKitAdapter({ kit: kit as never });
    const callback = vi.fn();

    await adapter.getPublicKey();
    adapter.onWalletConnectSessionDeleted(callback);
    expect(kit.onSessionDeleted).not.toHaveBeenCalled();

    await adapter.startWalletConnect({
      name: "Caatinga",
      description: "Caatinga dApp",
      url: "https://example.com",
      icons: ["https://example.com/icon.png"],
      projectId: "project-id"
    });

    const registered = kit.onSessionDeleted.mock.calls[0]?.[0] as (sessionId: string) => void;
    registered("session-1");

    await adapter.signTransaction({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015"
    });

    expect(callback).toHaveBeenCalledWith("session-1");
    expect(kit.getPublicKey).toHaveBeenCalledTimes(2);
  });
});
