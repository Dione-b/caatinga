import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkImportCeremonyCommand } from "./zk-import-ceremony.command.js";

const importCeremonyMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/zk", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/zk")>("@caatinga/zk");
  return {
    ...actual,
    importCeremony: importCeremonyMock,
  };
});

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

const baseConfig = {
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
    mainnet: {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
  zk: {
    circuits: {
      main: {
        path: "circuits",
        protocol: "groth16" as const,
        curve: "bls12381" as const,
        verifierContract: "verifier",
      },
      other: {
        path: "circuits/other",
        protocol: "groth16" as const,
        curve: "bls12381" as const,
        verifierContract: "verifier",
      },
    },
  },
};

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerZkImportCeremonyCommand(program);
  return program;
}

describe("zk import-ceremony command", () => {
  beforeEach(() => {
    importCeremonyMock.mockReset();
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(baseConfig);
    process.exitCode = undefined;
  });

  it("should_import_the_named_circuit", async () => {
    importCeremonyMock.mockResolvedValue({
      circuitHash: "a".repeat(64),
      publicSignals: 1,
      zkeyPath: ".artifacts/zk/other/circuit_final.zkey",
      verificationKeyPath: ".artifacts/zk/other/verification_key.json",
    });

    await createProgram().parseAsync([
      "node",
      "caatinga",
      "zk",
      "import-ceremony",
      "other",
      "--ceremony",
      "/tmp/ceremony",
    ]);

    expect(importCeremonyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        circuitName: "other",
        circuitPath: "circuits/other",
        artifactsDir: ".artifacts/zk/other",
        ceremonyDir: "/tmp/ceremony",
      })
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("should_pass_provenance_flags_through_to_the_manifest", async () => {
    importCeremonyMock.mockResolvedValue({
      circuitHash: "a".repeat(64),
      publicSignals: 1,
      zkeyPath: ".artifacts/zk/main/circuit_final.zkey",
      verificationKeyPath: ".artifacts/zk/main/verification_key.json",
    });

    await createProgram().parseAsync([
      "node",
      "caatinga",
      "zk",
      "import-ceremony",
      "--ceremony",
      "/tmp/ceremony",
      "--source-url",
      "https://example.org/ceremony",
      "--ceremony-name",
      "multiplier-2026",
      "--participants",
      "12",
      "--retrieved-at",
      "2026-10-01",
    ]);

    expect(importCeremonyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provenance: {
          sourceUrl: "https://example.org/ceremony",
          ceremony: "multiplier-2026",
          participants: 12,
          retrievedAt: "2026-10-01T00:00:00.000Z",
        },
      })
    );
  });

  it.each([
    ["--participants", "zero"],
    ["--participants", "0"],
    ["--retrieved-at", "not-a-date"],
  ])("should_reject_%s_%s", async (flag, value) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "zk",
        "import-ceremony",
        "--ceremony",
        "/tmp/ceremony",
        flag,
        value,
      ]);

      expect(process.exitCode).toBe(1);
      expect(importCeremonyMock).not.toHaveBeenCalled();
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_INVALID_CONFIG");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("should_default_to_the_first_configured_circuit", async () => {
    importCeremonyMock.mockResolvedValue({
      circuitHash: "b".repeat(64),
      publicSignals: 2,
      zkeyPath: ".artifacts/zk/main/circuit_final.zkey",
      verificationKeyPath: ".artifacts/zk/main/verification_key.json",
    });

    await createProgram().parseAsync([
      "node",
      "caatinga",
      "zk",
      "import-ceremony",
      "--ceremony",
      "/tmp/ceremony",
    ]);

    expect(importCeremonyMock).toHaveBeenCalledWith(
      expect.objectContaining({ circuitName: "main" })
    );
  });

  it("should_fail_for_an_unknown_circuit", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "zk",
        "import-ceremony",
        "nope",
        "--ceremony",
        "/tmp/ceremony",
      ]);

      expect(process.exitCode).toBe(1);
      expect(importCeremonyMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("should_fail_when_no_zk_circuits_are_configured", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    loadConfigMock.mockResolvedValue({ ...baseConfig, zk: undefined });

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "zk",
        "import-ceremony",
        "--ceremony",
        "/tmp/ceremony",
      ]);

      expect(process.exitCode).toBe(1);
      expect(importCeremonyMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("should_report_incompatible_ceremony_artifacts", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    importCeremonyMock.mockRejectedValue(
      Object.assign(new Error("verification key mismatch"), {
        code: "ZK_CEREMONY_INCOMPATIBLE",
      })
    );

    try {
      await createProgram().parseAsync([
        "node",
        "caatinga",
        "zk",
        "import-ceremony",
        "--ceremony",
        "/tmp/ceremony",
      ]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_ZK_CEREMONY_INCOMPATIBLE");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
