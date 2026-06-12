import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { generateBindingsGraph } from "@caatinga/core";
import { registerGenerateCommand } from "./generate.command.js";

const generateBindingsGraphMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const readArtifactsMock = vi.hoisted(() => vi.fn());
const evaluateBindingsFreshnessMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    generateBindingsGraph: generateBindingsGraphMock,
    loadConfig: loadConfigMock,
    readArtifacts: readArtifactsMock,
    evaluateBindingsFreshness: evaluateBindingsFreshnessMock
  };
});

const config: CaatingaConfig = {
  project: "counter-app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
      dependsOn: [],
      deployArgs: {}
    },
    token: {
      path: "./contracts/token",
      wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm",
      dependsOn: [],
      deployArgs: {}
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated"
  }
};

const counterResult = {
  contractName: "counter",
  network: { name: "testnet" },
  outputDir: "/tmp/counter",
  importPath: "./src/contracts/generated/counter/src/index.js",
  legacyStubRemoved: true,
  output: "generated"
};

const tokenResult = {
  contractName: "token",
  network: { name: "testnet" },
  outputDir: "/tmp/token",
  importPath: "./src/contracts/generated/token/src/index.js",
  legacyStubRemoved: false,
  output: "generated"
};

function createGenerateProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerGenerateCommand(program);
  return program;
}

describe("generate command", () => {
  beforeEach(() => {
    generateBindingsGraphMock.mockReset();
    loadConfigMock.mockReset();
    readArtifactsMock.mockReset();
    evaluateBindingsFreshnessMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    readArtifactsMock.mockResolvedValue({ project: "counter-app", version: 1, networks: {} });
    evaluateBindingsFreshnessMock.mockResolvedValue([]);
    generateBindingsGraphMock.mockResolvedValue({
      network: { name: "testnet" },
      results: [counterResult]
    });
  });

  it("passes the named contract to the graph and logs its import path and next step", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate", "counter"]);

      expect(generateBindingsGraph).toHaveBeenCalledWith({
        config,
        contractName: "counter",
        networkName: undefined
      });

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Import path: ./src/contracts/generated/counter/src/index.js");
      expect(output).toContain("Removed legacy stub: ./src/contracts/generated/counter.ts");
      expect(output).toContain("Next: import bindings from the import path above, then run npm run dev");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("generates all deployed contracts when no contract name is given", async () => {
    generateBindingsGraphMock.mockResolvedValue({
      network: { name: "testnet" },
      results: [counterResult, tokenResult]
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate"]);

      expect(generateBindingsGraph).toHaveBeenCalledWith({
        config,
        contractName: undefined,
        networkName: undefined
      });

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Import path: ./src/contracts/generated/counter/src/index.js");
      expect(output).toContain("Import path: ./src/contracts/generated/token/src/index.js");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("prints freshness pre-state in all-contracts mode", async () => {
    evaluateBindingsFreshnessMock.mockResolvedValue([
      {
        contractName: "counter",
        status: "stale",
        outputDir: "/tmp/counter",
        marker: null,
        reason: "wasmHash changed since last generate"
      },
      { contractName: "token", status: "fresh", outputDir: "/tmp/token", marker: null }
    ]);
    generateBindingsGraphMock.mockResolvedValue({
      network: { name: "testnet" },
      results: [counterResult, tokenResult]
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("[stale] counter — wasmHash changed since last generate");
      expect(output).toContain("[fresh] token");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("skips freshness pre-state when a contract name is given", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate", "counter"]);

      expect(evaluateBindingsFreshnessMock).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("does not log legacy stub removal when stub was not present", async () => {
    generateBindingsGraphMock.mockResolvedValue({
      network: { name: "testnet" },
      results: [tokenResult]
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).not.toContain("Removed legacy stub:");
    } finally {
      logSpy.mockRestore();
    }
  });
});
