import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID
} from "@creit.tech/stellar-wallets-kit";
import type { ISupportedWallet, ModuleInterface } from "@creit.tech/stellar-wallets-kit";
import {
  WalletConnectAllowedMethods,
  WalletConnectModule
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import type { CaatingaWalletAdapter } from "../types.js";

export { WalletNetwork };

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
  kit?: StellarWalletsKit;
  network?: WalletNetwork;
  /** Wallet pre-selected before the user opens the modal. Defaults to Freighter. */
  selectedWalletId?: string;
  /** Override the registered modules. Defaults to every auto-detectable wallet. */
  modules?: ModuleInterface[];
  walletConnectMetadata?: StellarWalletsKitMetadata;
}

export interface StellarWalletsKitOpenModalOptions {
  modalTitle?: string;
  notAvailableText?: string;
  onClosed?: (error: Error) => void;
}

export interface StellarWalletsKitAdapter extends CaatingaWalletAdapter {
  kit: StellarWalletsKit;
  /**
   * Opens the wallet-selection modal (lists only installed/available wallets),
   * sets the chosen wallet as active, and resolves with the connected address.
   * Rejects if the user closes the modal without selecting a wallet.
   */
  openModal(options?: StellarWalletsKitOpenModalOptions): Promise<string>;
  setWallet(walletId: string): void;
  getSupportedWallets(): Promise<ISupportedWallet[]>;
  disconnect(): Promise<void>;
}

export function createStellarWalletsKitAdapter(
  options: StellarWalletsKitAdapterOptions = {}
): StellarWalletsKitAdapter {
  const network = options.network ?? WalletNetwork.TESTNET;
  const kit =
    options.kit ??
    new StellarWalletsKit({
      network,
      selectedWalletId: options.selectedWalletId ?? FREIGHTER_ID,
      modules: options.modules ?? buildModules(network, options.walletConnectMetadata)
    });

  let address: string | undefined;

  return {
    kit,

    setWallet(walletId) {
      kit.setWallet(walletId);
      address = undefined;
    },

    getSupportedWallets() {
      return kit.getSupportedWallets();
    },

    openModal(modalOptions = {}) {
      return new Promise<string>((resolve, reject) => {
        void kit.openModal({
          ...(modalOptions.modalTitle ? { modalTitle: modalOptions.modalTitle } : {}),
          ...(modalOptions.notAvailableText
            ? { notAvailableText: modalOptions.notAvailableText }
            : {}),
          onWalletSelected: (option: ISupportedWallet) => {
            kit.setWallet(option.id);
            kit
              .getAddress()
              .then((result) => {
                address = result.address;
                resolve(result.address);
              })
              .catch((error) => {
                reject(error instanceof Error ? error : new Error(String(error)));
              });
          },
          onClosed: (error: Error) => {
            modalOptions.onClosed?.(error);
            reject(error);
          }
        });
      });
    },

    async getPublicKey() {
      const result = await kit.getAddress();
      address = result.address;
      return result.address;
    },

    async signTransaction({ xdr, networkPassphrase }) {
      const result = await kit.signTransaction(xdr, {
        networkPassphrase,
        ...(address ? { address } : {})
      });
      return result.signedTxXdr;
    },

    async disconnect() {
      await kit.disconnect();
      address = undefined;
    }
  };
}

// SWK's HOT Wallet module (NEAR-based) pulls @hot-wallet/sdk → @near-js/crypto →
// randombytes, which references the Node `global` and breaks in the browser.
// Drop it from the wallet list; consumers should also alias @hot-wallet/sdk to a
// stub in their bundler so the NEAR chain is never bundled (see template config).
const HOTWALLET_ID = "hot-wallet";

function buildModules(
  network: WalletNetwork,
  walletConnectMetadata?: StellarWalletsKitMetadata
): ModuleInterface[] {
  const modules = allowAllModules({
    filterBy: (module) => module.productId !== HOTWALLET_ID
  });

  if (walletConnectMetadata) {
    modules.push(
      new WalletConnectModule({
        ...walletConnectMetadata,
        network,
        method: WalletConnectAllowedMethods.SIGN
      })
    );
  }

  return modules;
}
