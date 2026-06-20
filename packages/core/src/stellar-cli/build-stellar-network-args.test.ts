import { describe, expect, it } from "vitest";
import {
  buildStellarNetworkArgs,
  buildStellarNetworkArgsFromConfig,
} from "./build-stellar-network-args.js";

describe("buildStellarNetworkArgs", () => {
  it("should_use_stellar_network_flag_for_well_known_testnet", () => {
    expect(
      buildStellarNetworkArgs({
        name: "testnet",
        config: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      })
    ).toEqual(["--network", "testnet"]);
  });

  it("should_infer_testnet_from_config_when_name_is_custom", () => {
    expect(
      buildStellarNetworkArgsFromConfig({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
    ).toEqual(["--network", "testnet"]);
  });

  it("should_use_rpc_url_for_custom_network_names", () => {
    expect(
      buildStellarNetworkArgs({
        name: "testnet",
        config: {
          rpcUrl: "https://custom-soroban.example.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      })
    ).toEqual([
      "--rpc-url",
      "https://custom-soroban.example.org",
      "--network-passphrase",
      "Test SDF Network ; September 2015",
    ]);
  });
});
