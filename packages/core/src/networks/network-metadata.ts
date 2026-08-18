import type { NetworkConfig } from "../config/config.schema.js";

type NetworkMetadata = {
  /** Name accepted by stellar-sdk / Stellar CLI --network shorthands. */
  sdkName: string;
  /** Default RPC URL, used only for boilerplate hints; the config always wins at runtime. */
  rpcUrl: string;
  /** Horizon REST base URL; absent for networks with no Horizon (futurenet). */
  horizonUrl?: string;
  /** Human label used in boilerplate hints. */
  label: string;
  /** Whether the Stellar CLI accepts the sdkName as a --network shorthand. */
  stellarCliShorthand: boolean;
};

/**
 * Single source of truth for SDF network metadata, keyed by passphrase so all
 * consumers (Horizon recovery, SDK generate, boilerplate hints, CLI shorthands)
 * stay in sync when a network is added or renamed.
 */
export const NETWORK_METADATA_BY_PASSPHRASE: Record<string, NetworkMetadata> = {
  "Test SDF Network ; September 2015": {
    sdkName: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    label: "Stellar Testnet",
    stellarCliShorthand: true,
  },
  "Public Global Stellar Network ; September 2015": {
    sdkName: "mainnet",
    rpcUrl: "https://mainnet.sorobanrpc.com",
    horizonUrl: "https://horizon.stellar.org",
    label: "Stellar Mainnet",
    stellarCliShorthand: true,
  },
  "Test SDF Future Network ; October 2022": {
    sdkName: "futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    label: "Stellar Futurenet",
    stellarCliShorthand: false,
  },
};

// Futurenet is deliberately excluded: the Stellar CLI has no `--network futurenet`
// shorthand, so it must always be passed explicit --rpc-url/--network-passphrase args.
export const WELL_KNOWN_NETWORKS: Record<string, NetworkConfig> = Object.fromEntries(
  Object.entries(NETWORK_METADATA_BY_PASSPHRASE)
    .filter(([, metadata]) => metadata.stellarCliShorthand)
    .map(([networkPassphrase, metadata]) => [
      metadata.sdkName,
      { rpcUrl: metadata.rpcUrl, networkPassphrase },
    ])
);
