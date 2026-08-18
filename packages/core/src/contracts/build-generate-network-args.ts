import { NETWORK_METADATA_BY_PASSPHRASE } from "../networks/network-metadata.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";

export function buildGenerateNetworkArgs(network: ResolvedNetwork): string[] {
  const sdkNetwork =
    NETWORK_METADATA_BY_PASSPHRASE[network.config.networkPassphrase]?.sdkName ?? "localnet";

  const args = ["--network", sdkNetwork, "--rpc-url", network.config.rpcUrl];

  // The SDK refuses insecure RPC unless told otherwise; local nodes are http.
  if (network.config.rpcUrl.startsWith("http://")) {
    args.push("--allow-http");
  }

  return args;
}
