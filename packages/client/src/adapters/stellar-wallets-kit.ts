import {
  StellarWalletsKit,
  WalletNetwork,
  WalletType
} from "stellar-wallets-kit";
import type { IConnectWalletConnectParams } from "stellar-wallets-kit";
import type { CaatingaWalletAdapter } from "../types.js";

export interface StellarWalletsKitMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
  projectId: string;
}

export interface StellarWalletsKitAdapterOptions {
  kit?: StellarWalletsKit;
  network?: WalletNetwork;
  selectedWallet?: WalletType;
  walletConnectMetadata?: StellarWalletsKitMetadata;
}

export interface StellarWalletsKitConnectOptions {
  chains?: IConnectWalletConnectParams["chains"];
  methods?: IConnectWalletConnectParams["methods"];
  pairingTopic?: IConnectWalletConnectParams["pairingTopic"];
}

export interface StellarWalletsKitSession {
  id: string;
  name: string;
  description: string;
  url: string;
  icons: string;
  accounts: Array<{
    network: "pubnet" | "testnet";
    publicKey: string;
  }>;
}

export interface StellarWalletsKitAdapter extends CaatingaWalletAdapter {
  kit: StellarWalletsKit;
  setWallet(wallet: WalletType): Promise<void>;
  setNetwork(network: WalletNetwork): Promise<void>;
  startWalletConnect(metadata?: StellarWalletsKitMetadata): Promise<void>;
  connectWalletConnect(options?: StellarWalletsKitConnectOptions): Promise<void>;
  getWalletConnectSessions(): Promise<StellarWalletsKitSession[]>;
  setWalletConnectSession(sessionId: string): void;
  onWalletConnectSessionDeleted(callback: (sessionId: string) => void): void;
}

export function createStellarWalletsKitAdapter(
  options: StellarWalletsKitAdapterOptions = {}
): StellarWalletsKitAdapter {
  const kit = options.kit ?? new StellarWalletsKit({
    network: options.network ?? WalletNetwork.TESTNET,
    selectedWallet: options.selectedWallet ?? WalletType.XBULL
  });
  let publicKey: string | undefined;
  let isWalletConnectStarted = false;
  const sessionDeletedCallbacks = new Set<(sessionId: string) => void>();

  return {
    kit,

    async setWallet(wallet) {
      await kit.setWallet(wallet);
      publicKey = undefined;
    },

    async setNetwork(network) {
      await kit.setNetwork(network);
      publicKey = undefined;
    },

    async getPublicKey() {
      publicKey = await kit.getPublicKey();
      return publicKey;
    },

    async signTransaction({ xdr, networkPassphrase }) {
      const walletNetwork = resolveWalletNetwork(networkPassphrase);
      if (walletNetwork) {
        await kit.setNetwork(walletNetwork);
      }

      const signer = publicKey ?? await kit.getPublicKey();
      publicKey = signer;
      const response = await kit.sign({ xdr, publicKey: signer });
      return response.signedXDR;
    },

    async startWalletConnect(metadata = options.walletConnectMetadata) {
      if (!metadata) {
        throw new Error("WalletConnect metadata is required before starting WalletConnect.");
      }

      await kit.startWalletConnect(metadata);
      isWalletConnectStarted = true;
      for (const callback of sessionDeletedCallbacks) {
        kit.onSessionDeleted((sessionId: string) => {
          publicKey = undefined;
          callback(sessionId);
        });
      }
    },

    async connectWalletConnect(connectOptions) {
      await kit.connectWalletConnect(connectOptions);
      publicKey = undefined;
    },

    async getWalletConnectSessions() {
      return kit.getSessions();
    },

    setWalletConnectSession(sessionId) {
      kit.setSession(sessionId);
      publicKey = undefined;
    },

    onWalletConnectSessionDeleted(callback) {
      sessionDeletedCallbacks.add(callback);
      if (!isWalletConnectStarted) {
        return;
      }

      kit.onSessionDeleted((sessionId: string) => {
        publicKey = undefined;
        callback(sessionId);
      });
    }
  };
}

function resolveWalletNetwork(networkPassphrase: string): WalletNetwork | undefined {
  if (networkPassphrase === "Test SDF Network ; September 2015") {
    return WalletNetwork.TESTNET;
  }

  if (networkPassphrase === "Public Global Stellar Network ; September 2015") {
    return WalletNetwork.PUBLIC;
  }

  return undefined;
}
