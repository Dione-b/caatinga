// Keep in sync with packages/templates/react-vite-counter/src/wallet.ts (WalletConnect defaults differ per project).
import {
  createStellarWalletsKitAdapter,
  WalletNetwork,
  type StellarWalletsKitMetadata,
} from "@caatinga/client/stellar-wallets-kit";

export const stellarWalletAdapter = createStellarWalletsKitAdapter({
  network: WalletNetwork.TESTNET,
  walletConnectMetadata: getWalletConnectMetadata(),
});

export { WalletNetwork };

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
    icons: [import.meta.env.VITE_APP_ICON_URL ?? `${window.location.origin}/icon.png`],
  };
}
