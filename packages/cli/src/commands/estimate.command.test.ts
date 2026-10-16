import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerEstimateCommand } from "./estimate.command.js";

const loadConfigMock = vi.hoisted(() => vi.fn());
const readVerificationKeyPublicSignalsMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

vi.mock("@caatinga/zk", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/zk")>("@caatinga/zk");
  return {
    ...actual,
    readVerificationKeyPublicSignals: readVerificationKeyPublicSignalsMock,
  };
});

const zkConfig = {
  project: "zk-app",
  defaultNetwork: "testnet",
  contracts: {
    verifier: {
      path: "./contracts/verifier",
      wasm: "./target/verifier.wasm",
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
  zk: {
    circuits: {
      "estimate-main": {
        path: "circuits",
        protocol: "groth16" as const,
        curve: "bls12381" as const,
        verifierContract: "verifier",
      },
    },
  },
};

const artifactsDir = path.join(process.cwd(), ".artifacts", "zk", "estimate-main");

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerEstimateCommand(program);
  return program;
}

describe("estimate verify command", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    readVerificationKeyPublicSignalsMock.mockReset();
    loadConfigMock.mockResolvedValue(zkConfig);
    process.exitCode = undefined;
  });

  afterEach(async () => {
    await rm(artifactsDir, { recursive: true, force: true });
  });

  it("should_report_cpu_and_memory_budgets_for_the_circuit", async () => {
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(path.join(artifactsDir, "verification_key.json"), "{}");
    readVerificationKeyPublicSignalsMock.mockResolvedValue(2);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "estimate", "verify", "estimate-main"]);

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("2 public signal(s)");
      expect(output).toContain("CPU:");
      expect(output).toContain("Memory:");
      expect(output).toContain("Verifier contract: verifier");
      expect(process.exitCode).toBeUndefined();
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("should_warn_when_the_budget_is_tight", async () => {
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(path.join(artifactsDir, "verification_key.json"), "{}");
    // 96 public signals measured ~382M instructions, close to the 400M tx limit.
    readVerificationKeyPublicSignalsMock.mockResolvedValue(96);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "estimate", "verify", "estimate-main"]);

      const warnings = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(warnings).toContain("CPU");
      expect(warnings).toContain("fitted to testnet simulations");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("should_fail_for_an_unknown_circuit", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "estimate", "verify", "nope"]);

      expect(process.exitCode).toBe(1);
      expect(readVerificationKeyPublicSignalsMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("should_fail_when_the_verification_key_is_missing", async () => {
    // No verification_key.json on disk: the VK reader raises ZK_VK_REQUIRED.
    readVerificationKeyPublicSignalsMock.mockRejectedValue(
      Object.assign(new Error("verification key missing"), { code: "ZK_VK_REQUIRED" })
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "estimate", "verify", "estimate-main"]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_ZK_VK_REQUIRED");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("should_check_the_protocol_version_when_a_network_is_given", async () => {
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(path.join(artifactsDir, "verification_key.json"), "{}");
    readVerificationKeyPublicSignalsMock.mockResolvedValue(1);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { protocolVersion: 26 } }), { status: 200 })
      );

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "estimate",
        "verify",
        "estimate-main",
        "--network",
        "testnet",
      ]);

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("Network: testnet");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("should_block_a_network_below_the_protocol_floor", async () => {
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(path.join(artifactsDir, "verification_key.json"), "{}");
    readVerificationKeyPublicSignalsMock.mockResolvedValue(1);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { protocolVersion: 24 } }), { status: 200 })
      );

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "estimate",
        "verify",
        "estimate-main",
        "--network",
        "testnet",
      ]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED");
      // The budget is never printed for a network that cannot verify at all.
      expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).not.toContain("CPU:");
    } finally {
      fetchSpy.mockRestore();
      errorSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
