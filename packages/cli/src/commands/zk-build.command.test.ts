import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkBuildCommand } from "./zk-build.command.js";

const buildCircuitMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/zk", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/zk")>("@caatinga/zk");
  return {
    ...actual,
    buildCircuit: buildCircuitMock,
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
      expect(output).toContain("experimental");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
