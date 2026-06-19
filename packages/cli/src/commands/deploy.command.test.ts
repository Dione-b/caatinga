import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { CaatingaError, CaatingaErrorCode, generateBindingsGraph } from "@caatinga/core";
import { registerDeployCommand } from "./deploy.command.js";

const deployContractGraphMock = vi.hoisted(() => vi.fn());
const generateBindingsGraphMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    deployContractGraph: deployContractGraphMock,
    generateBindingsGraph: generateBindingsGraphMock,
    loadConfig: loadConfigMock
  };
});

const CONTRACT_ID = `C${"2".repeat(55)}`;

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

const deployResult = {
  network: { name: "testnet" },
  deployedContracts: [{ name: "counter", contractId: CONTRACT_ID }],
  skippedContracts: [],
  staleWasmWarnings: []
};

const generateResult = {
  network: { name: "testnet" },
  results: [
    {
      contractName: "counter",
      network: { name: "testnet" },
      outputDir: "/tmp/counter",
      importPath: "./src/contracts/generated/counter",
      legacyStubRemoved: false,
      output: "generated"
    }
  ]
};

function createDeployProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerDeployCommand(program);
  return program;
}

describe("deploy command", () => {
  beforeEach(() => {
    deployContractGraphMock.mockReset();
    generateBindingsGraphMock.mockReset();
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    deployContractGraphMock.mockResolvedValue(deployResult);
    generateBindingsGraphMock.mockResolvedValue(generateResult);
    process.exitCode = undefined;
  });

  it("auto-generates bindings for the deployed contracts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createDeployProgram().parseAsync([
        "node", "caatinga", "deploy", "--source", "alice"
      ]);

      expect(generateBindingsGraph).toHaveBeenCalledWith({
        config,
        contractNames: ["counter"],
        networkName: "testnet"
      });

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Deploy complete");
      expect(output).toContain("Bindings generated");
      expect(output).toContain("counter → ./src/contracts/generated/counter");
      expect(output).toContain("npm run dev");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("skips generation with --no-generate and prints the manual commands", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createDeployProgram().parseAsync([
        "node", "caatinga", "deploy", "--source", "alice", "--no-generate"
      ]);

      expect(generateBindingsGraph).not.toHaveBeenCalled();

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Bindings generation skipped (--no-generate).");
      expect(output).toContain("npx caatinga generate counter --network testnet");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("keeps deploy successful when bindings generation fails", async () => {
    generateBindingsGraphMock.mockRejectedValue(
      new CaatingaError(
        "stellar bindings failed",
        CaatingaErrorCode.BINDINGS_FAILED,
        "Install Stellar CLI"
      )
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createDeployProgram().parseAsync([
        "node", "caatinga", "deploy", "--source", "alice"
      ]);

      expect(process.exitCode).toBeUndefined();

      const logOutput = logSpy.mock.calls.map((call) => call[0]).join("\n");
      const warnOutput = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(logOutput).toContain("Deploy complete");
      expect(warnOutput).toContain("Deploy succeeded, but bindings generation failed.");
      expect(warnOutput).toContain("CAATINGA_BINDINGS_FAILED");
      expect(logOutput).toContain("npx caatinga generate --network testnet");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("does not generate when nothing was newly deployed", async () => {
    deployContractGraphMock.mockResolvedValue({
      ...deployResult,
      deployedContracts: [],
      skippedContracts: [{ name: "counter", contractId: CONTRACT_ID }]
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createDeployProgram().parseAsync([
        "node", "caatinga", "deploy", "--source", "alice"
      ]);

      expect(generateBindingsGraph).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("skips bindings when project has no frontend configured", async () => {
    const minimalConfig: CaatingaConfig = {
      project: "minimal-app",
      defaultNetwork: "testnet",
      contracts: config.contracts,
      networks: config.networks
    };
    loadConfigMock.mockResolvedValue(minimalConfig);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createDeployProgram().parseAsync([
        "node", "caatinga", "deploy", "--source", "alice"
      ]);

      expect(generateBindingsGraph).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();

      const logOutput = logSpy.mock.calls.map((call) => call[0]).join("\n");
      const warnOutput = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(logOutput).toContain("Deploy complete");
      expect(logOutput).toContain("Bindings skipped (no frontend configured).");
      expect(warnOutput).not.toContain("Deploy succeeded, but bindings generation failed.");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
