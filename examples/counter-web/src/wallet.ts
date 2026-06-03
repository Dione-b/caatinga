import {
  createStellarWalletsKitAdapter,
  type StellarWalletsKitMetadata
} from "@caatinga/client/stellar-wallets-kit";
import { WalletNetwork, WalletType } from "stellar-wallets-kit";

export const stellarWalletAdapter = createStellarWalletsKitAdapter({
  network: WalletNetwork.TESTNET,
  selectedWallet: WalletType.XBULL,
  walletConnectMetadata: getWalletConnectMetadata()
});

export { WalletNetwork, WalletType };

function getWalletConnectMetadata(): StellarWalletsKitMetadata | undefined {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (!projectId) {
    return undefined;
  }

  return {
    projectId,
    name: import.meta.env.VITE_APP_NAME ?? "Counter Web",
    description: import.meta.env.VITE_APP_DESCRIPTION ?? "Caatinga counter web example",
    url: import.meta.env.VITE_APP_URL ?? window.location.origin,
    icons: [import.meta.env.VITE_APP_ICON_URL ?? `${window.location.origin}/icon.png`]
  };
}
