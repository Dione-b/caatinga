import { describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "./resolve-network.js";

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    counter: { path: "./c", wasm: "./w.wasm", dependsOn: [], deployArgs: {} },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    mainnet: {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./out" },
};

describe("resolveNetwork", () => {
  it("should_resolve_default_network_when_name_omitted", () => {
    const r = resolveNetwork(baseConfig);
    expect(r.name).toBe("testnet");
    expect(r.config.rpcUrl).toContain("testnet");
  });

  it("should_resolve_explicit_network_when_configured", () => {
    const r = resolveNetwork(baseConfig, "mainnet");
    expect(r.name).toBe("mainnet");
    expect(r.config.rpcUrl).toContain("mainnet");
  });

  it("should_throw_CAATINGA_NETWORK_NOT_FOUND_when_name_missing", () => {
    try {
      resolveNetwork(baseConfig, "futurenet");
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      const ce = error as CaatingaError;
      expect(ce.code).toBe(CaatingaErrorCode.NETWORK_NOT_FOUND);
      expect(ce.hint).toContain("Stellar Futurenet Boilerplate:");
    }
  });

  it("should_include_testnet_boilerplate_in_hint_when_testnet_is_missing", () => {
    const configWithoutTestnet = {
      ...baseConfig,
      networks: { mainnet: baseConfig.networks.mainnet },
    };
    try {
      resolveNetwork(configWithoutTestnet, "testnet");
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      const ce = error as CaatingaError;
      expect(ce.code).toBe(CaatingaErrorCode.NETWORK_NOT_FOUND);
      expect(ce.hint).toContain("Stellar Testnet Boilerplate:");
    }
  });

  it("should_include_mainnet_boilerplate_in_hint_when_mainnet_is_missing", () => {
    const configWithoutMainnet = {
      ...baseConfig,
      networks: { testnet: baseConfig.networks.testnet },
    };
    try {
      resolveNetwork(configWithoutMainnet, "mainnet");
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      const ce = error as CaatingaError;
      expect(ce.code).toBe(CaatingaErrorCode.NETWORK_NOT_FOUND);
      expect(ce.hint).toContain("Stellar Mainnet Boilerplate:");
    }
  });
});
