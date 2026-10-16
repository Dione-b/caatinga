import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkVerifyCeremonyCommand } from "./zk-verify-ceremony.command.js";

const verifyCeremonyMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/zk", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/zk")>("@caatinga/zk");
  return { ...actual, verifyCeremony: verifyCeremonyMock };
});

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return { ...actual, loadConfig: loadConfigMock };
});

const config = {
  project: "zk-app",
  defaultNetwork: "testnet",
  contracts: {},
  networks: {},
  zk: {
    circuits: {
      main: {
        path: "circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier",
      },
    },
  },
};

const manifest = {
  type: "mpc-multi-party",
  generatedAt: "2026-10-01T00:00:00.000Z",
  circuitHash: "a".repeat(64),
  publicSignals: 1,
  provenance: {
    ceremony: "multiplier-2026",
    retrievedAt: "2026-10-01T00:00:00.000Z",
    curve: "bls12381",
  },
};

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerZkVerifyCeremonyCommand(program);
  return program;
}

describe("zk verify-ceremony command", () => {
  beforeEach(() => {
    verifyCeremonyMock.mockReset();
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    process.exitCode = undefined;
  });

  it("should_verify_the_default_circuit_and_print_provenance", async () => {
    verifyCeremonyMock.mockResolvedValue({
      manifest,
      mismatches: [],
      zkey: "verified",
      verificationKeyMatchesZkey: true,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "zk", "verify-ceremony"]);

      expect(verifyCeremonyMock).toHaveBeenCalledWith(
        expect.objectContaining({ artifactsDir: ".artifacts/zk/main" })
      );
      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("snarkjs zkey verify");
      expect(output).toContain("multiplier-2026");
      expect(process.exitCode).toBeUndefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should_warn_when_zkey_verification_was_skipped_for_lack_of_a_ptau", async () => {
    verifyCeremonyMock.mockResolvedValue({
      manifest,
      mismatches: [],
      zkey: "skipped",
      verificationKeyMatchesZkey: true,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "zk", "verify-ceremony", "main"]);

      const output = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("zkey verify skipped");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("should_report_CAATINGA_ZK_CEREMONY_TAMPERED", async () => {
    verifyCeremonyMock.mockRejectedValue(
      Object.assign(new Error("Ceremony artifacts changed since import"), {
        code: "ZK_CEREMONY_TAMPERED",
      })
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await createProgram().parseAsync(["node", "caatinga", "zk", "verify-ceremony"]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_ZK_CEREMONY_TAMPERED");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
