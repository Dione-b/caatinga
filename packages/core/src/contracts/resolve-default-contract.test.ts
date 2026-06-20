import { describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDefaultContractName } from "./resolve-default-contract.js";

const baseConfig: CaatingaConfig = {
  project: "test-app",
  defaultNetwork: "testnet",
  contracts: {},
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/bindings",
  },
};

describe("resolveDefaultContractName", () => {
  it("returns the sole configured contract name", () => {
    const config: CaatingaConfig = {
      ...baseConfig,
      contracts: {
        verifier: {
          path: "./contracts/verifier",
          wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",
          dependsOn: [],
          deployArgs: {},
        },
      },
    };

    expect(resolveDefaultContractName(config)).toBe("verifier");
  });

  it("throws when multiple contracts are configured", () => {
    const config: CaatingaConfig = {
      ...baseConfig,
      contracts: {
        counter: {
          path: "./contracts/counter",
          wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
          dependsOn: [],
          deployArgs: {},
        },
        token: {
          path: "./contracts/token",
          wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm",
          dependsOn: [],
          deployArgs: {},
        },
      },
    };

    expect(() => resolveDefaultContractName(config)).toThrow(CaatingaError);
    try {
      resolveDefaultContractName(config);
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      const caatingaError = error as CaatingaError;
      expect(caatingaError.code).toBe(CaatingaErrorCode.CONTRACT_NOT_FOUND);
      expect(caatingaError.hint).toContain("counter");
      expect(caatingaError.hint).toContain("token");
    }
  });
});
