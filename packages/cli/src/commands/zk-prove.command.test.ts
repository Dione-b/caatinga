import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkProveCommand } from "./zk-prove.command.js";

const proveCircuitMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/zk", () => ({
  proveCircuit: proveCircuitMock,
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
          },
        },
      },
    }),
  };
});

describe("zk prove command", () => {
  beforeEach(() => {
    proveCircuitMock.mockReset();
    proveCircuitMock.mockResolvedValue(undefined);
  });

  it("delegates to proveCircuit", async () => {
    const program = new Command();
    program.exitOverride();
    registerZkProveCommand(program);

    await program.parseAsync(["node", "caatinga", "zk", "prove"]);

    expect(proveCircuitMock).toHaveBeenCalledWith({
      circuitName: "main",
      circuitPath: "circuits",
      artifactsDir: ".artifacts/zk/main",
      inputPath: "circuits/input.json",
      debug: false,
    });
  });
});
