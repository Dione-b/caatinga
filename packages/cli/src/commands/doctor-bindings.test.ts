import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "@caatinga/core";
import { evaluateBindingCoverage } from "./doctor-bindings.js";

const loadConfigMock = vi.hoisted(() => vi.fn());
const readArtifactsMock = vi.hoisted(() => vi.fn());
const evaluateBindingsFreshnessMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
    readArtifacts: readArtifactsMock,
    evaluateBindingsFreshness: evaluateBindingsFreshnessMock,
  };
});

const config: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./rel/counter.wasm",
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
  frontend: { framework: "vite-react", bindingsOutput: "./src/gen" },
};

describe("evaluateBindingCoverage", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    readArtifactsMock.mockReset();
    evaluateBindingsFreshnessMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    readArtifactsMock.mockResolvedValue({ project: "app", version: 1, networks: {} });
  });

  it("reports allFresh when every contract has fresh bindings", async () => {
    evaluateBindingsFreshnessMock.mockResolvedValue([
      { contractName: "counter", status: "fresh", outputDir: "/x", marker: null },
    ]);

    const coverage = await evaluateBindingCoverage({ networkName: "testnet" });

    expect(coverage.allFresh).toBe(true);
    expect(coverage.lines).toEqual([{ name: "counter", status: "fresh", reason: undefined }]);
  });

  it("adds a fix command for stale and missing bindings", async () => {
    evaluateBindingsFreshnessMock.mockResolvedValue([
      {
        contractName: "counter",
        status: "stale",
        outputDir: "/x",
        marker: null,
        reason: "wasmHash changed since last generate",
      },
      { contractName: "token", status: "missing", outputDir: "/y", marker: null },
    ]);

    const coverage = await evaluateBindingCoverage({ networkName: "testnet" });

    expect(coverage.allFresh).toBe(false);
    expect(coverage.lines[0]).toMatchObject({
      name: "counter",
      status: "stale",
      fix: "Run: npx caatinga generate counter --network testnet",
    });
    expect(coverage.lines[1]).toMatchObject({
      name: "token",
      status: "missing",
      fix: "Run: npx caatinga generate token --network testnet",
    });
  });

  it("returns no lines when nothing is deployed", async () => {
    evaluateBindingsFreshnessMock.mockResolvedValue([]);

    const coverage = await evaluateBindingCoverage({ networkName: "testnet" });

    expect(coverage.lines).toEqual([]);
    expect(coverage.allFresh).toBe(true);
  });
});
