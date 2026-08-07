import { describe, expect, it } from "vitest";
import { buildGenerateNetworkArgs } from "./build-generate-network-args.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";

function network(name: string, rpcUrl: string, networkPassphrase: string): ResolvedNetwork {
  return { name, config: { rpcUrl, networkPassphrase } };
}

describe("buildGenerateNetworkArgs", () => {
  it("maps the mainnet passphrase to --network mainnet, no --allow-http", () => {
    expect(
      buildGenerateNetworkArgs(
        network(
          "mainnet",
          "https://mainnet.sorobanrpc.com",
          "Public Global Stellar Network ; September 2015"
        )
      )
    ).toEqual(["--network", "mainnet", "--rpc-url", "https://mainnet.sorobanrpc.com"]);
  });

  it("maps the testnet passphrase to --network testnet", () => {
    expect(
      buildGenerateNetworkArgs(
        network(
          "testnet",
          "https://soroban-testnet.stellar.org",
          "Test SDF Network ; September 2015"
        )
      )
    ).toEqual(["--network", "testnet", "--rpc-url", "https://soroban-testnet.stellar.org"]);
  });

  it("maps the futurenet passphrase to --network futurenet", () => {
    expect(
      buildGenerateNetworkArgs(
        network(
          "futurenet",
          "https://rpc-futurenet.stellar.org",
          "Test SDF Future Network ; October 2022"
        )
      )
    ).toEqual(["--network", "futurenet", "--rpc-url", "https://rpc-futurenet.stellar.org"]);
  });

  it("defaults an unrecognized passphrase to --network localnet and adds --allow-http for http RPCs", () => {
    expect(
      buildGenerateNetworkArgs(
        network(
          "local",
          "http://localhost:8000/soroban/rpc",
          "Standalone Network ; February 2017"
        )
      )
    ).toEqual([
      "--network",
      "localnet",
      "--rpc-url",
      "http://localhost:8000/soroban/rpc",
      "--allow-http",
    ]);
  });

  it("resolves via the passphrase and never leaks the raw Caatinga network name", () => {
    expect(
      buildGenerateNetworkArgs(
        network(
          "my-custom-name",
          "https://soroban-testnet.stellar.org",
          "Test SDF Network ; September 2015"
        )
      )
    ).toEqual(["--network", "testnet", "--rpc-url", "https://soroban-testnet.stellar.org"]);
  });

  it("omits --allow-http for https RPCs", () => {
    expect(
      buildGenerateNetworkArgs(
        network("local", "https://rpc.example.com", "Standalone Network ; February 2017")
      )
    ).toEqual(["--network", "localnet", "--rpc-url", "https://rpc.example.com"]);
  });
});
