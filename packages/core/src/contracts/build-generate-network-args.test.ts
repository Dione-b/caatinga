import { describe, expect, it } from "vitest";
import { buildGenerateNetworkArgs } from "./build-generate-network-args.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";

const testnet: ResolvedNetwork = {
  name: "testnet",
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
};

const custom: ResolvedNetwork = {
  name: "my-net",
  config: {
    rpcUrl: "https://rpc.example.com",
    networkPassphrase: "Custom Passphrase",
  },
};

describe("buildGenerateNetworkArgs", () => {
  it("emits --network and --rpc-url for well-known networks", () => {
    expect(buildGenerateNetworkArgs(testnet)).toEqual([
      "--network",
      "testnet",
      "--rpc-url",
      "https://soroban-testnet.stellar.org",
    ]);
  });

  it("emits only --rpc-url for custom networks (passphrase not needed to generate)", () => {
    expect(buildGenerateNetworkArgs(custom)).toEqual(["--rpc-url", "https://rpc.example.com"]);
  });
});
