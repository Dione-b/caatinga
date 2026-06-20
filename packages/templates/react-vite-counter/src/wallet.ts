// Keep in sync with examples/counter-web/src/wallet.ts (WalletConnect defaults differ per project).
import {
  createStellarWalletsKitAdapter,
  WalletNetwork,
  type StellarWalletsKitMetadata,
} from "@caatinga/client/stellar-wallets-kit";
import { requestWalletSelection } from "./wallet-modal-controller.js";

const baseWalletAdapter = createStellarWalletsKitAdapter({
  network: WalletNetwork.TESTNET,
  walletConnectMetadata: getWalletConnectMetadata(),
});

// Route connect() through the custom <WalletModal> instead of SWK's built-in
// authModal. Everything else (persistence, restore, signing) is untouched.
export const stellarWalletAdapter = {
  ...baseWalletAdapter,
  openModal: () => requestWalletSelection(),
};

export { WalletNetwork };

function getWalletConnectMetadata(): StellarWalletsKitMetadata | undefined {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (!projectId) {
    return undefined;
  }

  return {
    projectId,
    name: import.meta.env.VITE_APP_NAME ?? "__PROJECT_NAME__",
    description: import.meta.env.VITE_APP_DESCRIPTION ?? "Caatinga counter dApp",
    url: import.meta.env.VITE_APP_URL ?? window.location.origin,
    icons: [import.meta.env.VITE_APP_ICON_URL ?? `${window.location.origin}/icon.png`],
  };
}
