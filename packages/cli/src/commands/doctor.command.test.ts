import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { registerDoctorCommand } from "./doctor.command.js";

const runAllDiagnosticsMock = vi.hoisted(() => vi.fn());
const evaluateDeployCoverageMock = vi.hoisted(() => vi.fn());
const evaluateBindingCoverageMock = vi.hoisted(() => vi.fn());
const reportCliVersionChannelMock = vi.hoisted(() => vi.fn());

vi.mock("../diagnostics/run-all.js", () => ({
  runAllDiagnostics: runAllDiagnosticsMock,
}));

vi.mock("./doctor-deploy-coverage.js", () => ({
  evaluateDeployCoverage: evaluateDeployCoverageMock,
}));

vi.mock("./doctor-bindings.js", () => ({
  evaluateBindingCoverage: evaluateBindingCoverageMock,
}));

vi.mock("./doctor-env-sync.js", () => ({
  evaluateEnvSyncDiagnostics: vi.fn().mockResolvedValue({ report: null, lines: [] }),
}));

vi.mock("./doctor-wasm-drift.js", () => ({
  evaluateWasmDriftDiagnostics: vi.fn().mockResolvedValue([]),
}));

vi.mock("./doctor-post-deploy.js", () => ({
  evaluatePostDeployDiagnostics: vi.fn().mockReturnValue([]),
}));

vi.mock("./doctor-cli-version.js", () => ({
  reportCliVersionChannel: reportCliVersionChannelMock,
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

const zkConfig: CaatingaConfig = {
  project: "zk-app",
  defaultNetwork: "testnet",
  contracts: {
    verifier: {
      path: "./contracts/verifier",
      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",
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
};

describe("doctor command", () => {
  beforeEach(() => {
    runAllDiagnosticsMock.mockReset();
    evaluateDeployCoverageMock.mockReset();
    evaluateBindingCoverageMock.mockReset();
    reportCliVersionChannelMock.mockReset();
    reportCliVersionChannelMock.mockResolvedValue({ note: undefined });
    process.exitCode = undefined;

    runAllDiagnosticsMock.mockResolvedValue({
      diagnostics: [
        { ok: true, label: "Node.js" },
        { ok: true, label: "Stellar CLI" },
      ],
      config,
    });
    evaluateBindingCoverageMock.mockResolvedValue({ lines: [], allFresh: true });
  });

  it("should_remain_ready_when_default_network_has_partial_deploy_without_explicit_network_flag", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: false,
      lines: [
        {
          name: "app",
          ok: false,
          fix: "Run: npx ctg deploy app --network testnet --source <identity>",
        },
      ],
    });

    await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

    expect(runAllDiagnosticsMock).toHaveBeenCalledWith({ network: undefined, source: undefined });
    expect(evaluateDeployCoverageMock).toHaveBeenCalledWith({ networkName: "testnet" });
    expect(process.exitCode).toBeUndefined();
  });

  it("should_use_explicit_network_flag_when_provided", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: true,
      lines: [{ name: "app", ok: true, contractId: "C".padEnd(56, "A") }],
    });

    await createDoctorProgram().parseAsync(["node", "caatinga", "doctor", "--network", "testnet"]);

    expect(runAllDiagnosticsMock).toHaveBeenCalledWith({ network: "testnet", source: undefined });
    expect(evaluateDeployCoverageMock).toHaveBeenCalledWith({ networkName: "testnet" });
    expect(process.exitCode).toBeUndefined();
  });

  it("should_not_run_deploy_coverage_when_diagnostics_fail", async () => {
    runAllDiagnosticsMock.mockResolvedValue({
      diagnostics: [{ ok: false, label: "caatinga.config.ts not found", fix: "Run npx ctg init." }],
      config: undefined,
    });

    await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

    expect(evaluateDeployCoverageMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("should_report_the_cli_release_channel_without_blocking_readiness", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({ complete: true, lines: [] });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

      expect(reportCliVersionChannelMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("should_keep_doctor_advisory_when_running_a_prerelease_ahead_of_latest", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({ complete: true, lines: [] });
    reportCliVersionChannelMock.mockImplementation(async () => {
      console.warn(
        "Running @caatinga/cli 3.9.1 (published under the 'next' npm tag), which is ahead of the 'latest' npm tag (3.8.0) — this may be a pre-release build."
      );
      return { note: "pre-release" };
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("ahead of the 'latest' npm tag")
      );
      const output = logSpy.mock.calls.map(([chunk]) => String(chunk)).join("\n");
      expect(output).toContain("Status: ready");
      expect(process.exitCode).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("should_report_zk_circuit_protocol_readiness_as_an_advisory", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({ complete: true, lines: [] });
    runAllDiagnosticsMock.mockResolvedValue({
      diagnostics: [
        { ok: true, label: "Node.js" },
        { ok: true, label: "Stellar CLI" },
      ],
      config: zkConfig,
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { protocolVersion: 28 } }), { status: 200 })
      );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

      const output = logSpy.mock.calls.map(([chunk]) => String(chunk)).join("\n");
      expect(output).toContain("ZK circuits:");
      expect(output).toContain("main");
      expect(output).toContain("Protocol required for verification: >= 27");
      expect(output).toContain("testnet: protocol 28");
      // A protocol below the floor must be reported, but must never block doctor.
      expect(warnSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it("should_warn_without_blocking_when_the_network_is_below_the_zk_protocol_floor", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({ complete: true, lines: [] });
    runAllDiagnosticsMock.mockResolvedValue({
      diagnostics: [
        { ok: true, label: "Node.js" },
        { ok: true, label: "Stellar CLI" },
      ],
      config: zkConfig,
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { protocolVersion: 24 } }), { status: 200 })
      );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("testnet: protocol 24"));
      expect(process.exitCode).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it("should_not_report_zk_circuits_for_a_project_without_them", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({ complete: true, lines: [] });

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createDoctorProgram().parseAsync(["node", "caatinga", "doctor"]);

      const output = logSpy.mock.calls.map(([chunk]) => String(chunk)).join("\n");
      expect(output).not.toContain("ZK circuits:");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });
});
