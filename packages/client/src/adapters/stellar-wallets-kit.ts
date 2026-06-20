import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import {
  Networks,
  type ISupportedWallet,
  type ModuleInterface,
  type StellarWalletsKitInitParams,
} from "@creit.tech/stellar-wallets-kit/types";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { HOTWALLET_ID } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";
import { WalletConnectModule } from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";
import type { CaatingaWalletAdapter } from "../types.js";

export { Networks as WalletNetwork };

/**
 * Optional WalletConnect metadata. When provided, a WalletConnect module is
 * registered alongside the auto-detected wallets so it shows up in the modal.
 */
export interface StellarWalletsKitMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
  projectId: string;
}

export interface StellarWalletsKitAdapterOptions {
  network?: Networks;
  /** Wallet pre-selected before the user opens the modal. Defaults to Freighter. */
  selectedWalletId?: string;
  /** Override the registered modules. Defaults to every auto-detectable wallet. */
  modules?: ModuleInterface[];
  walletConnectMetadata?: StellarWalletsKitMetadata;
  /** Extra SWK init options (theme, authModal flags, etc.). */
  initParams?: Omit<StellarWalletsKitInitParams, "modules" | "network" | "selectedWalletId">;
}

export interface StellarWalletsKitOpenModalOptions {
  modalTitle?: string;
  notAvailableText?: string;
  onClosed?: (error: Error) => void;
}

export interface StellarWalletsKitAdapter extends CaatingaWalletAdapter {
  /** SWK 2.x uses static methods on this class (no per-app instance). */
  kit: typeof StellarWalletsKit;
  /**
   * Opens the wallet-selection modal (lists only installed/available wallets),
   * sets the chosen wallet as active, and resolves with the connected address.
   * Rejects if the user closes the modal without selecting a wallet.
   */
  openModal(options?: StellarWalletsKitOpenModalOptions): Promise<string>;
  setWallet(walletId: string): void;
  /** Id of the wallet currently selected in the kit, or undefined before any selection. */
  getWalletId(): string | undefined;
  getSupportedWallets(): Promise<ISupportedWallet[]>;
  disconnect(): Promise<void>;
}

let kitInitialized = false;

/** @internal Resets the one-time init guard (tests only). */
export function resetStellarWalletsKitAdapterForTests(): void {
  kitInitialized = false;
}

export function createStellarWalletsKitAdapter(
  options: StellarWalletsKitAdapterOptions = {}
): StellarWalletsKitAdapter {
  const network = options.network ?? Networks.TESTNET;

  if (!kitInitialized) {
    StellarWalletsKit.init({
      network,
      selectedWalletId: options.selectedWalletId ?? FREIGHTER_ID,
      modules: options.modules ?? buildModules(options.walletConnectMetadata),
      ...options.initParams,
    });
    kitInitialized = true;
  } else if (options.network !== undefined) {
    StellarWalletsKit.setNetwork(network);
  }

  let address: string | undefined;

  return {
    kit: StellarWalletsKit,

    setWallet(walletId) {
      StellarWalletsKit.setWallet(walletId);
      address = undefined;
    },

    getWalletId() {
      // Read from the kit so authModal/setWallet selections stay the single
      // source of truth. The getter throws while no wallet is selected.
      try {
        return StellarWalletsKit.selectedModule.productId;
      } catch {
        return undefined;
      }
    },

    getSupportedWallets() {
      return StellarWalletsKit.refreshSupportedWallets();
    },

    async openModal(modalOptions = {}) {
      try {
        const result = await StellarWalletsKit.authModal();
        address = result.address;
        return result.address;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        modalOptions.onClosed?.(normalized);
        throw normalized;
      }
    },

    async getPublicKey() {
      // getAddress() returns only the kit's cached activeAddress, which is
      // populated by SWK's built-in authModal. Templates that swap authModal for
      // a custom modal (setWallet + getPublicKey) never populate it, so fall back
      // to fetchAddress() which queries the selected wallet module directly.
      try {
        const cached = await StellarWalletsKit.getAddress();
        address = cached.address;
        return cached.address;
      } catch {
        const fetched = await StellarWalletsKit.fetchAddress();
        address = fetched.address;
        return fetched.address;
      }
    },

    async signTransaction({ xdr, networkPassphrase }) {
      const result = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase,
        ...(address ? { address } : {}),
      });
      return result.signedTxXdr;
    },

    async disconnect() {
      await StellarWalletsKit.disconnect();
      address = undefined;
    },
  };
}

// SWK's HOT Wallet module (NEAR-based) pulls @hot-wallet/sdk → @near-js/crypto →
// randombytes, which references the Node `global` and breaks in the browser.
// Drop it from the wallet list; consumers should also alias @hot-wallet/sdk to a
// stub in their bundler so the NEAR chain is never bundled (see template config).
function buildModules(walletConnectMetadata?: StellarWalletsKitMetadata): ModuleInterface[] {
  const modules = defaultModules({
    filterBy: (module) => module.productId !== HOTWALLET_ID,
  });

  if (walletConnectMetadata) {
    const { projectId, name, description, url, icons } = walletConnectMetadata;
    modules.push(
      new WalletConnectModule({
        projectId,
        metadata: { name, description, url, icons },
      })
    );
  }

  return modules;
}
