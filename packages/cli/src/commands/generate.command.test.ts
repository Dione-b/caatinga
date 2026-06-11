import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { generateBindings } from "@caatinga/core";
import { registerGenerateCommand } from "./generate.command.js";

const generateBindingsMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    generateBindings: generateBindingsMock,
    loadConfig: loadConfigMock
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

function createGenerateProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerGenerateCommand(program);
  return program;
}

describe("generate command", () => {
  beforeEach(() => {
    generateBindingsMock.mockReset();
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    generateBindingsMock.mockResolvedValue({
      contractName: "counter",
      network: config.networks.testnet,
      outputDir: "/tmp/counter",
      importPath: "./src/contracts/generated/counter/src/index.js",
      legacyStubRemoved: true,
      output: "generated"
    });
  });

  it("logs import path, legacy stub removal, and next step after success", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate", "counter"]);

      expect(generateBindings).toHaveBeenCalledWith({
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

  it("does not log legacy stub removal when stub was not present", async () => {
    generateBindingsMock.mockResolvedValue({
      contractName: "counter",
      network: config.networks.testnet,
      outputDir: "/tmp/counter",
      importPath: "./src/contracts/generated/counter/src/index.js",
      legacyStubRemoved: false,
      output: "generated"
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createGenerateProgram().parseAsync(["node", "caatinga", "generate", "counter"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).not.toContain("Removed legacy stub:");
    } finally {
      logSpy.mockRestore();
    }
  });
});
