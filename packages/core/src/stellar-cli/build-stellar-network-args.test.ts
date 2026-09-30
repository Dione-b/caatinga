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

  it("should_pass_explicit_rpc_args_for_well_known_mainnet", () => {
    // The Stellar CLI's built-in `mainnet` entry has no RPC URL ("Bring Your
    // Own"), so `--network mainnet` would ignore the configured rpcUrl.
    const mainnet = {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    };
    const expected = [
      "--rpc-url",
      "https://mainnet.sorobanrpc.com",
      "--network-passphrase",
      "Public Global Stellar Network ; September 2015",
    ];

    expect(buildStellarNetworkArgs({ name: "mainnet", config: mainnet })).toEqual(expected);
    expect(buildStellarNetworkArgsFromConfig(mainnet)).toEqual(expected);
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
