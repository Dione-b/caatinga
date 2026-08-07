import type { ResolvedNetwork } from "../networks/resolve-network.js";

// @stellar/stellar-sdk's `generate` requires --network on every network fetch, and
// only accepts these four literal names — a Caatinga network name (e.g. "local")
// cannot be passed through verbatim. The passphrase is the dependable signal, since
// it is already mandatory in the config.
const SDK_NETWORK_BY_PASSPHRASE: Record<string, string> = {
  "Public Global Stellar Network ; September 2015": "mainnet",
  "Test SDF Network ; September 2015": "testnet",
  "Test SDF Future Network ; October 2022": "futurenet",
};

export function buildGenerateNetworkArgs(network: ResolvedNetwork): string[] {
  const sdkNetwork = SDK_NETWORK_BY_PASSPHRASE[network.config.networkPassphrase] ?? "localnet";

  const args = ["--network", sdkNetwork, "--rpc-url", network.config.rpcUrl];

  // The SDK refuses insecure RPC unless told otherwise; local nodes are http.
  if (network.config.rpcUrl.startsWith("http://")) {
    args.push("--allow-http");
  }

  return args;
}
