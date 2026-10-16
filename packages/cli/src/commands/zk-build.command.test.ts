import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkBuildCommand } from "./zk-build.command.js";

const buildCircuitMock = vi.hoisted(() => vi.fn());
const readCeremonyManifestMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/zk", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/zk")>("@caatinga/zk");
  return {
    ...actual,
    buildCircuit: buildCircuitMock,
    readCeremonyManifest: readCeremonyManifestMock,
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
  frontend: {
    framework: "vite-react" as const,
    bindingsOutput: "./src/bindings",
  },
  zk: {
    circuits: {
      main: {
        path: "circuits",
        protocol: "groth16" as const,
        curve: "bls12381" as const,
        verifierContract: "verifier",
      },
    },
  },
};

describe("zk build command", () => {
  beforeEach(() => {
    buildCircuitMock.mockReset();
    buildCircuitMock.mockResolvedValue(undefined);
    readCeremonyManifestMock.mockReset();
    // Default to a dev ceremony, matching what a fresh `ctg zk build` leaves.
    readCeremonyManifestMock.mockResolvedValue({ type: "dev-single-party", generatedAt: "now" });
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(baseConfig);
  });

  it("delegates to buildCircuit with the configured circuit", async () => {
    const program = new Command();
    program.exitOverride();
    registerZkBuildCommand(program);

    await program.parseAsync(["node", "caatinga", "zk", "build", "main"]);

    expect(buildCircuitMock).toHaveBeenCalledWith({
      circuitName: "main",
      circuitPath: "circuits",
      artifactsDir: ".artifacts/zk/main",
      embedVk: false,
      progress: expect.objectContaining({
        onStatus: expect.any(Function),
        onDownloadProgress: expect.any(Function),
        onDownloadComplete: expect.any(Function),
      }),
    });
  });

  it("fails on mainnet defaultNetwork without --allow-dev-ceremony", async () => {
    loadConfigMock.mockResolvedValue({
      ...baseConfig,
      defaultNetwork: "mainnet",
    });
    process.exitCode = undefined;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkBuildCommand(program);

      await program.parseAsync(["node", "caatinga", "zk", "build", "main"]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_ZK_DEV_CEREMONY_BLOCKED");
      expect(buildCircuitMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("fails with --network mainnet even when defaultNetwork is testnet", async () => {
    process.exitCode = undefined;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkBuildCommand(program);

      await program.parseAsync(["node", "caatinga", "zk", "build", "main", "--network", "mainnet"]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_ZK_DEV_CEREMONY_BLOCKED");
      expect(buildCircuitMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("allows --network testnet when defaultNetwork is mainnet", async () => {
    loadConfigMock.mockResolvedValue({
      ...baseConfig,
      defaultNetwork: "mainnet",
    });

    const program = new Command();
    program.exitOverride();
    registerZkBuildCommand(program);

    await program.parseAsync(["node", "caatinga", "zk", "build", "main", "--network", "testnet"]);

    expect(buildCircuitMock).toHaveBeenCalled();
  });

  it("fails with CAATINGA_NETWORK_NOT_FOUND for an unknown --network", async () => {
    process.exitCode = undefined;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkBuildCommand(program);

      await program.parseAsync([
        "node",
        "caatinga",
        "zk",
        "build",
        "main",
        "--network",
        "futurenet",
      ]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("CAATINGA_NETWORK_NOT_FOUND");
      expect(buildCircuitMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("allows mainnet defaultNetwork with --allow-dev-ceremony", async () => {
    loadConfigMock.mockResolvedValue({
      ...baseConfig,
      defaultNetwork: "mainnet",
    });

    const program = new Command();
    program.exitOverride();
    registerZkBuildCommand(program);

    await program.parseAsync(["node", "caatinga", "zk", "build", "main", "--allow-dev-ceremony"]);

    expect(buildCircuitMock).toHaveBeenCalled();
  });

  it("warns when --embed-vk is passed", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkBuildCommand(program);

      await program.parseAsync(["node", "caatinga", "zk", "build", "main", "--embed-vk"]);

      expect(buildCircuitMock).toHaveBeenCalledWith(expect.objectContaining({ embedVk: true }));
      const output = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("contracts/verifier/src/vk.rs");
      expect(output).toContain("verify_proof_embedded");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not claim a dev ceremony when imported MPC artifacts were reused", async () => {
    readCeremonyManifestMock.mockResolvedValue({
      type: "mpc-multi-party",
      generatedAt: "now",
      circuitHash: "a".repeat(64),
      publicSignals: 1,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkBuildCommand(program);

      await program.parseAsync(["node", "caatinga", "zk", "build", "main"]);

      const warnings = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(warnings).not.toContain("Single-party development trusted setup");
      expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
        "imported MPC ceremony artifacts"
      );
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
