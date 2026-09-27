import type { NetworkConfig } from "../config/config.schema.js";
import { NETWORK_METADATA_BY_PASSPHRASE } from "../networks/network-metadata.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";

/**
 * Returns the Stellar CLI `--network` shorthand for a config that exactly
 * matches a well-known network whose built-in CLI entry has a working RPC.
 * Mainnet never qualifies: the CLI's `mainnet` entry has no RPC URL, so the
 * configured `rpcUrl` must always be passed explicitly.
 */
function stellarCliShorthandFor(config: NetworkConfig): string | undefined {
  const metadata = NETWORK_METADATA_BY_PASSPHRASE[config.networkPassphrase];
  if (!metadata?.stellarCliShorthand || !metadata.stellarCliBuiltinRpc) {
    return undefined;
  }

  return metadata.rpcUrl === config.rpcUrl ? metadata.sdkName : undefined;
}

function buildRpcNetworkArgs(config: NetworkConfig): string[] {
  return ["--rpc-url", config.rpcUrl, "--network-passphrase", config.networkPassphrase];
}

export function buildStellarNetworkArgsFromConfig(config: NetworkConfig): string[] {
  const shorthand = stellarCliShorthandFor(config);
  return shorthand ? ["--network", shorthand] : buildRpcNetworkArgs(config);
}

export function buildStellarNetworkArgs(network: ResolvedNetwork): string[] {
  return buildStellarNetworkArgsFromConfig(network.config);
}
