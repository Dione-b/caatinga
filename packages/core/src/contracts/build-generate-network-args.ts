import { WELL_KNOWN_NETWORKS } from "../networks/networks.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";

export function buildGenerateNetworkArgs(network: ResolvedNetwork): string[] {
  if (WELL_KNOWN_NETWORKS[network.name]) {
    return ["--network", network.name, "--rpc-url", network.config.rpcUrl];
  }
  return ["--rpc-url", network.config.rpcUrl];
}
