import { describe, expect, it } from "vitest";
import { CaatingaConfigSchema } from "./config.schema.js";

const minimalValid = {
  project: "my-dapp",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./target/wasm32v1-none/release/counter.wasm",
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: {
    framework: "vite-react" as const,
    bindingsOutput: "./src/contracts/generated",
  },
};

describe("CaatingaConfigSchema", () => {
  it("should_parse_valid_config_when_all_required_fields_present", () => {
    const parsed = CaatingaConfigSchema.parse(minimalValid);
    expect(parsed.project).toBe("my-dapp");
    expect(parsed.defaultNetwork).toBe("testnet");
    expect(parsed.contracts.counter.path).toContain("counter");
  });

  it("should_apply_default_network_when_omitted", () => {
    const { defaultNetwork: _defaultNetwork, ...rest } = minimalValid;
    const parsed = CaatingaConfigSchema.parse(rest);
    expect(parsed.defaultNetwork).toBe("testnet");
  });

  it("should_apply_default_framework_when_omitted", () => {
    const { frontend: _frontend, ...rest } = minimalValid;
    const parsed = CaatingaConfigSchema.parse({
      ...rest,
      frontend: { bindingsOutput: "./out" },
    });
    expect(parsed.frontend?.framework).toBe("vite-react");
  });

  it("accepts zk-only config without frontend", () => {
    const { frontend: _frontend, ...zkOnly } = {
      ...minimalValid,
      zk: {
        circuits: {
          main: {
            path: "./circuits",
            protocol: "groth16" as const,
            curve: "bls12381" as const,
            verifierContract: "verifier",
          },
        },
      },
    };

    const parsed = CaatingaConfigSchema.parse(zkOnly);

    expect(parsed.frontend).toBeUndefined();
    expect(parsed.zk?.circuits.main.verifierContract).toBe("verifier");
  });

  it("should_reject_when_contracts_record_empty", () => {
    expect(() =>
      CaatingaConfigSchema.parse({
        ...minimalValid,
        contracts: {},
      })
    ).toThrow();
  });

  it("should_reject_when_networks_record_empty", () => {
    expect(() =>
      CaatingaConfigSchema.parse({
        ...minimalValid,
        networks: {},
      })
    ).toThrow();
  });

  it("accepts contract dependencies and deploy args", () => {
    const result = CaatingaConfigSchema.parse({
      project: "marketplace-app",
      defaultNetwork: "testnet",
      contracts: {
        token: {
          path: "./contracts/token",
          wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm",
        },
        marketplace: {
          path: "./contracts/marketplace",
          wasm: "./contracts/marketplace/target/wasm32v1-none/release/marketplace.wasm",
          dependsOn: ["token"],
          deployArgs: {
            tokenContractId: "${contracts.token.contractId}",
          },
        },
      },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
      frontend: {
        framework: "vite-react",
        bindingsOutput: "./src/contracts/generated",
      },
    });

    expect(result.contracts.marketplace.dependsOn).toEqual(["token"]);
    expect(result.contracts.marketplace.deployArgs).toEqual({
      tokenContractId: "${contracts.token.contractId}",
    });
  });

  it("parses zk circuit configuration", () => {
    const result = CaatingaConfigSchema.parse({
      ...minimalValid,
      zk: {
        circuits: {
          main: {
            path: "./circuits",
            protocol: "groth16",
            curve: "bls12381",
            verifierContract: "verifier",
          },
        },
      },
    });

    expect(result.zk?.circuits.main.curve).toBe("bls12381");
  });

  it("rejects unsupported zk curves", () => {
    expect(() =>
      CaatingaConfigSchema.parse({
        ...minimalValid,
        zk: {
          circuits: {
            main: {
              path: "./circuits",
              protocol: "groth16",
              curve: "bn128",
            },
          },
        },
      })
    ).toThrow();
  });
});
