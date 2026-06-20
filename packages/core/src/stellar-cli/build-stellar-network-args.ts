import type { NetworkConfig } from "../config/config.schema.js";
import { WELL_KNOWN_NETWORKS } from "../networks/networks.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";

function matchesWellKnownNetwork(name: string, config: NetworkConfig): boolean {
  const known = WELL_KNOWN_NETWORKS[name];
  if (!known) {
    return false;
  }

  return known.rpcUrl === config.rpcUrl && known.networkPassphrase === config.networkPassphrase;
}

function buildRpcNetworkArgs(config: NetworkConfig): string[] {
  return ["--rpc-url", config.rpcUrl, "--network-passphrase", config.networkPassphrase];
}

export function buildStellarNetworkArgsFromConfig(config: NetworkConfig): string[] {
  for (const [name, known] of Object.entries(WELL_KNOWN_NETWORKS)) {
    if (known.rpcUrl === config.rpcUrl && known.networkPassphrase === config.networkPassphrase) {
      return ["--network", name];
    }
  }

  return buildRpcNetworkArgs(config);
}

export function buildStellarNetworkArgs(network: ResolvedNetwork): string[] {
  if (matchesWellKnownNetwork(network.name, network.config)) {
    return ["--network", network.name];
  }

  return buildStellarNetworkArgsFromConfig(network.config);
}
