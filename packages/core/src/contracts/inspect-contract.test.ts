import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { inspectContract } from "./inspect-contract.js";

const readArtifactsMock = vi.hoisted(() => vi.fn());
const checkBinaryMock = vi.hoisted(() => vi.fn());
const verifyDependencyContractMock = vi.hoisted(() => vi.fn());
const resolveWasmArtifactPathMock = vi.hoisted(() => vi.fn());
const hashWasmMock = vi.hoisted(() => vi.fn());

vi.mock("../artifacts/read-artifacts.js", () => ({
  readArtifacts: readArtifactsMock,
}));

vi.mock("../shell/check-binary.js", () => ({
  checkBinary: checkBinaryMock,
}));

vi.mock("./verify-dependency-contract.js", () => ({
  verifyDependencyContract: verifyDependencyContractMock,
}));

vi.mock("./wasm.js", () => ({
  resolveWasmArtifactPath: resolveWasmArtifactPathMock,
  hashWasm: hashWasmMock,
}));

const CONTRACT_ID = "C".padEnd(56, "A");
const ARTIFACT_HASH = "a".repeat(64);

const config: CaatingaConfig = {
  project: "yield-app",
  defaultNetwork: "testnet",
  contracts: {
    yield_distributor: {
      path: "./contracts/yield_distributor",
      wasm: "./contracts/yield_distributor/target/wasm32v1-none/release/yield_distributor.wasm",
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
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated",
  },
};

const CWD = "/tmp/app";
const MAINNET_WASM = "./deploy/mainnet-wasm/yield_distributor.wasm";

function mainnetArtifacts() {
  return {
    project: "yield-app",
    version: 1 as const,
    networks: {
      mainnet: {
        contracts: {
          yield_distributor: {
            contractId: CONTRACT_ID,
            wasmHash: ARTIFACT_HASH,
            deployedAt: "2026-01-01T00:00:00.000Z",
            wasmPath: MAINNET_WASM,
            sourcePath: "./contracts/yield_distributor",
            dependencies: [],
            resolvedDeployArgs: {},
          },
        },
        dependencyGraph: {},
      },
    },
  };
}

describe("inspectContract", () => {
  beforeEach(() => {
    readArtifactsMock.mockReset();
    checkBinaryMock.mockReset();
    checkBinaryMock.mockResolvedValue(undefined);
    verifyDependencyContractMock.mockReset();
    verifyDependencyContractMock.mockResolvedValue(undefined);
    resolveWasmArtifactPathMock.mockReset();
    hashWasmMock.mockReset();
  });

  it("hashes the per-network artifact wasmPath, not the config wasm (#133 bug 1)", async () => {
    readArtifactsMock.mockResolvedValue(mainnetArtifacts());
    resolveWasmArtifactPathMock.mockResolvedValue("/tmp/app/deploy/mainnet-wasm/yield_distributor.wasm");
    hashWasmMock.mockResolvedValue(ARTIFACT_HASH);

    const result = await inspectContract({
      config,
      contractName: "yield_distributor",
      networkName: "mainnet",
      cwd: CWD,
    });

    // The local WASM source must be the mainnet artifact path resolved against
    // cwd — never the testnet config build output.
    expect(resolveWasmArtifactPathMock).toHaveBeenCalledWith(
      path.resolve(CWD, MAINNET_WASM),
      expect.anything()
    );
    expect(result.localWasm.path).toBe(MAINNET_WASM);
    expect(result.localWasm.hash).toBe(ARTIFACT_HASH);
    expect(result.localWasm.matchesArtifact).toBe(true);
  });

  it("surfaces the underlying Stellar CLI output when the contract is unreachable (#133 bug 2)", async () => {
    readArtifactsMock.mockResolvedValue(mainnetArtifacts());
    resolveWasmArtifactPathMock.mockResolvedValue("/tmp/app/deploy/mainnet-wasm/yield_distributor.wasm");
    hashWasmMock.mockResolvedValue(ARTIFACT_HASH);

    const cliFailure = new CaatingaError(
      "Command failed: stellar contract info interface",
      CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
      "error: contract not found on network mainnet",
      undefined
    );
    verifyDependencyContractMock.mockRejectedValue(
      new CaatingaError(
        `Dependency "yield_distributor" is not deployed on "mainnet" (contract ID ${CONTRACT_ID}).`,
        CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        "Deploy the dependency on this network.",
        cliFailure
      )
    );

    const result = await inspectContract({
      config,
      contractName: "yield_distributor",
      networkName: "mainnet",
      cwd: CWD,
    });

    expect(result.onChain.reachable).toBe(false);
    expect(result.onChain.detail).toContain("is not deployed");
    expect(result.onChain.detail).toContain("Stellar CLI: error: contract not found on network mainnet");
  });
});
