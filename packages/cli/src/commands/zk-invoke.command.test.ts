import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { CaatingaErrorCode } from "@caatinga/core";
import { registerZkInvokeCommand } from "./zk-invoke.command.js";

const invokeVerifierMock = vi.hoisted(() => vi.fn());
const assertDevCeremonyAllowedMock = vi.hoisted(() => vi.fn());
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
}));

vi.mock("@caatinga/zk", () => ({
  invokeVerifier: invokeVerifierMock,
  assertDevCeremonyAllowed: assertDevCeremonyAllowedMock,
  zkArtifactsDir: (name: string) => `.artifacts/zk/${name}`,
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
    assertDevCeremonyAllowedMock.mockReset();
    assertDevCeremonyAllowedMock.mockResolvedValue(undefined);
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

    expect(assertDevCeremonyAllowedMock).toHaveBeenCalledWith({
      networkName: "testnet",
      artifactsDir: ".artifacts/zk/main",
      allowDevCeremony: false,
      operation: "ctg zk invoke main",
    });

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

  it("passes --network to invokeVerifier", async () => {
    const program = new Command();
    program.exitOverride();
    registerZkInvokeCommand(program);

    await program.parseAsync([
      "node",
      "caatinga",
      "zk",
      "invoke",
      "--source",
      "alice",
      "--network",
      "mainnet",
      "--allow-dev-ceremony",
    ]);

    expect(assertDevCeremonyAllowedMock).toHaveBeenCalledWith(
      expect.objectContaining({ networkName: "mainnet", allowDevCeremony: true })
    );
    expect(invokeVerifierMock).toHaveBeenCalledWith(
      expect.objectContaining({ network: "mainnet" })
    );
  });

  it("rejects --embed-vk", async () => {
    process.exitCode = undefined;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkInvokeCommand(program);

      await program.parseAsync([
        "node",
        "caatinga",
        "zk",
        "invoke",
        "--source",
        "alice",
        "--embed-vk",
      ]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain(CaatingaErrorCode.INVALID_CONFIG);
      expect(invokeVerifierMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
