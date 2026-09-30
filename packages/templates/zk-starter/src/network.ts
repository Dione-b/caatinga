import type { CaatingaNetwork } from "@caatinga/client";

/**
 * Network the app talks to. `ctg deploy` / `ctg sync-env` write these to `.env.local`
 * from `caatinga.config.ts` (see `frontend.env`), so the app follows the network you
 * deployed to. With none set, the app uses testnet.
 */
function resolveAppNetwork(): CaatingaNetwork {
  const name = import.meta.env.VITE_CAATINGA_NETWORK as string | undefined;
  const rpcUrl = import.meta.env.VITE_CAATINGA_RPC_URL as string | undefined;
  const networkPassphrase = import.meta.env.VITE_CAATINGA_NETWORK_PASSPHRASE as string | undefined;

  if (!name && !rpcUrl && !networkPassphrase) {
    return {
      name: "testnet",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    };
  }

  if (!name || !rpcUrl || !networkPassphrase) {
    throw new Error(
      "Set VITE_CAATINGA_NETWORK, VITE_CAATINGA_RPC_URL and VITE_CAATINGA_NETWORK_PASSPHRASE together " +
        "(run `npx ctg sync-env --network <name>`)."
    );
  }

  return { name, rpcUrl, networkPassphrase };
}

export const appNetwork = resolveAppNetwork();
