import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { registerDoctorCommand } from "./doctor.command.js";

const runAllDiagnosticsMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const evaluateDeployCoverageMock = vi.hoisted(() => vi.fn());
const evaluateBindingCoverageMock = vi.hoisted(() => vi.fn());

vi.mock("../diagnostics/run-all.js", () => ({
  runAllDiagnostics: runAllDiagnosticsMock,
}));

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

vi.mock("./doctor-deploy-coverage.js", () => ({
  evaluateDeployCoverage: evaluateDeployCoverageMock,
}));

vi.mock("./doctor-bindings.js", () => ({
  evaluateBindingCoverage: evaluateBindingCoverageMock,
}));

const config: CaatingaConfig = {
  project: "minimal-app",
  defaultNetwork: "testnet",
  contracts: {
    app: {
      path: "./contracts/app",
      wasm: "./contracts/app/target/wasm32v1-none/release/app.wasm",
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
};

function createDoctorProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerDoctorCommand(program);
  return program;
}

describe("doctor command", () => {
  beforeEach(() => {
    runAllDiagnosticsMock.mockReset();
    loadConfigMock.mockReset();
    evaluateDeployCoverageMock.mockReset();
    evaluateBindingCoverageMock.mockReset();
    process.exitCode = undefined;

    runAllDiagnosticsMock.mockResolvedValue([
      { ok: true, label: "Node.js" },
      { ok: true, label: "Stellar CLI" },
    ]);
    loadConfigMock.mockResolvedValue(config);
    evaluateBindingCoverageMock.mockResolvedValue({ lines: [], allFresh: true });
  });

  it("should_exit_with_code_1_when_default_network_has_partial_deploy_without_explicit_network_flag", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: false,
      lines: [
        {
          name: "app",
          ok: false,
          fix: "Run: caatinga deploy app --network testnet --source <identity>",
        },
      ],
    });

    await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

    expect(loadConfigMock).toHaveBeenCalled();
    expect(evaluateDeployCoverageMock).toHaveBeenCalledWith({ networkName: "testnet" });
    expect(process.exitCode).toBe(1);
  });

  it("should_use_explicit_network_flag_when_provided", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: true,
      lines: [{ name: "app", ok: true, contractId: "C".padEnd(56, "A") }],
    });

    await createDoctorProgram().parseAsync(["node", "caatinga", "doctor", "--network", "testnet"]);

    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(evaluateDeployCoverageMock).toHaveBeenCalledWith({ networkName: "testnet" });
    expect(process.exitCode).toBeUndefined();
  });

  it("should_not_run_deploy_coverage_when_diagnostics_fail", async () => {
    runAllDiagnosticsMock.mockResolvedValue([
      { ok: false, label: "caatinga.config.ts not found", fix: "Run caatinga init." },
    ]);

    await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

    expect(evaluateDeployCoverageMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
