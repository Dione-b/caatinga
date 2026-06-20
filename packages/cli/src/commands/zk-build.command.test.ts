import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkBuildCommand } from "./zk-build.command.js";

const buildCircuitMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/zk", () => ({
  buildCircuit: buildCircuitMock,
}));

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({
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
      frontend: {
        framework: "vite-react",
        bindingsOutput: "./src/bindings",
      },
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
    }),
  };
});

describe("zk build command", () => {
  beforeEach(() => {
    buildCircuitMock.mockReset();
    buildCircuitMock.mockResolvedValue(undefined);
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
});
