import { describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { NetworkConfigSchema } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { WELL_KNOWN_NETWORKS } from "./networks.js";
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

  describe("boilerplate hint contents", () => {
    const hintFor = (networkName: string): string => {
      try {
        resolveNetwork({ ...baseConfig, networks: {} } as CaatingaConfig, networkName);
        expect.fail("expected throw");
      } catch (error) {
        return (error as CaatingaError).hint ?? "";
      }
    };

    /** Reads the snippet back as an object so the *keys* are asserted, not just the values. */
    const parseBoilerplate = (hint: string, networkName: string): Record<string, string> => {
      const block = new RegExp(`\\n {4}${networkName}: \\{\\n([\\s\\S]*?)\\n {4}\\}`).exec(hint);
      expect(block, `no boilerplate block for ${networkName} in:\n${hint}`).not.toBeNull();

      const fields = [...(block as RegExpExecArray)[1].matchAll(/^\s*(\w+): "(.*?)",?$/gm)];
      expect(fields.length).toBeGreaterThan(0);

      return Object.fromEntries(fields.map((field) => [field[1], field[2]]));
    };

    it.each(["testnet", "mainnet"])(
      "emits a %s snippet that matches WELL_KNOWN_NETWORKS exactly",
      (networkName) => {
        const parsed = parseBoilerplate(hintFor(networkName), networkName);

        expect(parsed).toEqual(WELL_KNOWN_NETWORKS[networkName]);
      }
    );

    it.each(["testnet", "mainnet", "futurenet"])(
      "emits a %s snippet that satisfies NetworkConfigSchema when copied",
      (networkName) => {
        const parsed = parseBoilerplate(hintFor(networkName), networkName);

        // The old hand-written hint used `passphrase:`, so copying it produced
        // CAATINGA_INVALID_CONFIG. Parsing with the real schema is the only assertion
        // that actually proves the snippet is copy-pasteable.
        expect(() => NetworkConfigSchema.parse(parsed)).not.toThrow();
        expect(Object.keys(parsed)).toEqual(["rpcUrl", "networkPassphrase"]);
      }
    );

    it("uses the mainnet Soroban RPC url and the September 2015 passphrase", () => {
      const parsed = parseBoilerplate(hintFor("mainnet"), "mainnet");

      expect(parsed.rpcUrl).toBe("https://mainnet.sorobanrpc.com");
      expect(parsed.networkPassphrase).toBe("Public Global Stellar Network ; September 2015");
    });

    it.each(["testnet", "mainnet", "futurenet"])(
      "does not append a :443 port to the %s rpc url",
      (networkName) => {
        const parsed = parseBoilerplate(hintFor(networkName), networkName);

        expect(parsed.rpcUrl).not.toContain(":443");
      }
    );

    it("omits fields the config schema does not accept", () => {
      const parsed = parseBoilerplate(hintFor("futurenet"), "futurenet");

      expect(parsed.friendbotUrl).toBeUndefined();
      expect(parsed.passphrase).toBeUndefined();
    });
  });
});
