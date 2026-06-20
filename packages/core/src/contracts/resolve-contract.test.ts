import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveContract } from "./resolve-contract.js";

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./target/counter.wasm",
      dependsOn: [],
      deployArgs: {},
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./out" },
};

describe("resolveContract", () => {
  it("should_resolve_paths_relative_to_cwd", () => {
    const cwd = "/tmp/proj";
    const r = resolveContract(baseConfig, "counter", cwd);
    expect(r.name).toBe("counter");
    expect(r.sourcePath).toBe(path.resolve(cwd, "./contracts/counter"));
    expect(r.wasmPath).toBe(path.resolve(cwd, "./target/counter.wasm"));
  });

  it("should_throw_CAATINGA_CONTRACT_NOT_FOUND_when_name_unknown", () => {
    try {
      resolveContract(baseConfig, "token");
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      expect((error as CaatingaError).code).toBe(CaatingaErrorCode.CONTRACT_NOT_FOUND);
    }
  });
});
