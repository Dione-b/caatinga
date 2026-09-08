import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { CaatingaErrorCode } from "@caatinga/core";
import { registerRegressionCommand } from "./regression.command.js";

const deployContractGraphMock = vi.hoisted(() => vi.fn());
const generateBindingsGraphMock = vi.hoisted(() => vi.fn());
const runSmokeReadsMock = vi.hoisted(() => vi.fn());
const mockConfig = vi.hoisted(() => ({
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./target/token.wasm",
      dependsOn: [],
      deployArgs: {},
    },
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
  frontend: {
    framework: "vite-react" as const,
    bindingsOutput: "./src/bindings",
  },
}));

vi.mock("execa", () => ({ execa: vi.fn() }));

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(mockConfig),
    deployContractGraph: deployContractGraphMock,
    generateBindingsGraph: generateBindingsGraphMock,
    runSmokeReads: runSmokeReadsMock,
  };
});

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerRegressionCommand(program);
  return program;
}

describe("regression command", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    deployContractGraphMock.mockReset();
    deployContractGraphMock.mockResolvedValue({ deployedContracts: [], skippedContracts: [] });
    generateBindingsGraphMock.mockReset();
    generateBindingsGraphMock.mockResolvedValue(undefined);
    runSmokeReadsMock.mockReset();
    runSmokeReadsMock.mockResolvedValue([]);
  });

  it("blocks unattended mainnet deploy without --yes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "regression",
        "--source",
        "alice",
        "--network",
        "mainnet",
        "--skip-test",
        "--skip-build",
      ]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain(CaatingaErrorCode.MAINNET_CONFIRMATION_REQUIRED);
      expect(deployContractGraphMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("deploys on mainnet when --yes is passed", async () => {
    await createProgram().parseAsync([
      "node",
      "caatinga",
      "regression",
      "--source",
      "alice",
      "--network",
      "mainnet",
      "--skip-test",
      "--skip-build",
      "--yes",
    ]);

    expect(process.exitCode).toBeUndefined();
    expect(deployContractGraphMock).toHaveBeenCalledWith(
      expect.objectContaining({ networkName: "mainnet", source: "alice" })
    );
  });

  it("does not require confirmation when the deploy step is skipped", async () => {
    await createProgram().parseAsync([
      "node",
      "caatinga",
      "regression",
      "--source",
      "alice",
      "--network",
      "mainnet",
      "--skip-test",
      "--skip-build",
      "--skip-deploy",
    ]);

    expect(process.exitCode).toBeUndefined();
    expect(deployContractGraphMock).not.toHaveBeenCalled();
    expect(generateBindingsGraphMock).toHaveBeenCalled();
  });
});
