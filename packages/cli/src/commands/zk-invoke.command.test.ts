import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerZkInvokeCommand } from "./zk-invoke.command.js";

const invokeVerifierMock = vi.hoisted(() => vi.fn());
const mockConfig = vi.hoisted(() => ({
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
}));

vi.mock("@caatinga/zk", () => ({
  invokeVerifier: invokeVerifierMock,
}));

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(mockConfig),
  };
});

describe("zk invoke command", () => {
  beforeEach(() => {
    invokeVerifierMock.mockReset();
    invokeVerifierMock.mockResolvedValue({
      network: "testnet",
      verifierContract: "verifier",
      contractId: "CAJSNRSGL5BIS67LTVLFCZC6KITVRPA7YEO7YGUOBVJETMI3TONYYERP",
      publicSignals: ["33"],
      verified: true,
    });
  });

  it("delegates to invokeVerifier", async () => {
    const program = new Command();
    program.exitOverride();
    registerZkInvokeCommand(program);

    await program.parseAsync(["node", "caatinga", "zk", "invoke", "--source", "alice"]);

    expect(invokeVerifierMock).toHaveBeenCalledWith({
      verifierContract: "verifier",
      network: "testnet",
      sourceAccount: "alice",
      proofPath: ".artifacts/zk/main/proof.json",
      vkPath: ".artifacts/zk/main/verification_key.json",
      publicSignalsPath: ".artifacts/zk/main/public.json",
      embedVk: false,
      config: mockConfig,
    });
  });
});
