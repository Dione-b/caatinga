import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  // Minimal shape of the spy this suite needs; typing it as `vi.spyOn`'s
  // overloaded return drags in generic parameters that never line up.
  let fetchSpy:
    | {
        mockRestore: () => void;
        mockResolvedValue: (value: Response) => void;
        mockRejectedValue: (value: unknown) => void;
      }
    | undefined;

  beforeEach(() => {
    invokeVerifierMock.mockReset();
    assertDevCeremonyAllowedMock.mockReset();
    assertDevCeremonyAllowedMock.mockResolvedValue(undefined);
    process.exitCode = undefined;
    // The protocol pre-flight queries the network; stub it so the tests stay
    // offline and deterministic instead of hitting real RPC endpoints.
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { protocolVersion: 27 } }), { status: 200 })
      );
    invokeVerifierMock.mockResolvedValue({
      network: "testnet",
      verifierContract: "verifier",
      contractId: "CAJSNRSGL5BIS67LTVLFCZC6KITVRPA7YEO7YGUOBVJETMI3TONYYERP",
      publicSignals: ["33"],
      verified: true,
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = undefined;
  });

  it("delegates to invokeVerifier", async () => {
    const program = new Command();
    program.exitOverride();
    registerZkInvokeCommand(program);

    await program.parseAsync(["node", "caatinga", "zk", "invoke", "--source", "alice"]);

    expect(assertDevCeremonyAllowedMock).toHaveBeenCalledWith({
      networkName: "testnet",
      networkConfig: {
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      },
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
      "--yes",
    ]);

    expect(assertDevCeremonyAllowedMock).toHaveBeenCalledWith(
      expect.objectContaining({ networkName: "mainnet", allowDevCeremony: true })
    );
    expect(invokeVerifierMock).toHaveBeenCalledWith(
      expect.objectContaining({ network: "mainnet" })
    );
  });

  it("blocks unattended mainnet invoke without --yes", async () => {
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
        "--network",
        "mainnet",
        "--allow-dev-ceremony",
      ]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain(CaatingaErrorCode.MAINNET_CONFIRMATION_REQUIRED);
      expect(invokeVerifierMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
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
      expect(output).toContain(CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED);
      expect(invokeVerifierMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("blocks an invoke on a network below the protocol floor", async () => {
    process.exitCode = undefined;
    fetchSpy?.mockResolvedValue(
      new Response(JSON.stringify({ result: { protocolVersion: 24 } }), { status: 200 })
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkInvokeCommand(program);

      await program.parseAsync(["node", "caatinga", "zk", "invoke", "--source", "alice"]);

      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain(CaatingaErrorCode.ZK_PROTOCOL_VERSION_UNSUPPORTED);
      expect(invokeVerifierMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("warns but proceeds when the protocol version is unknown", async () => {
    process.exitCode = undefined;
    fetchSpy?.mockRejectedValue(new Error("ECONNREFUSED"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const program = new Command();
      program.exitOverride();
      registerZkInvokeCommand(program);

      await program.parseAsync(["node", "caatinga", "zk", "invoke", "--source", "alice"]);

      // A pre-flight that cannot reach the network must not block a real invoke:
      // the on-chain call reports the actual problem with better context.
      expect(warnSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
        "Could not determine the protocol version"
      );
      expect(invokeVerifierMock).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
