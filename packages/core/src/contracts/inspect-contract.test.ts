import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const readArtifacts = vi.hoisted(() => vi.fn());
const checkBinary = vi.hoisted(() => vi.fn());
const resolveContract = vi.hoisted(() => vi.fn());
const resolveWasmArtifactPath = vi.hoisted(() => vi.fn());
const hashWasm = vi.hoisted(() => vi.fn());
const verifyDependencyContract = vi.hoisted(() => vi.fn());

vi.mock("../artifacts/read-artifacts.js", () => ({ readArtifacts }));
vi.mock("../shell/check-binary.js", () => ({ checkBinary }));
vi.mock("./resolve-contract.js", () => ({ resolveContract }));
vi.mock("./wasm.js", () => ({ hashWasm, resolveWasmArtifactPath }));
vi.mock("./verify-dependency-contract.js", () => ({ verifyDependencyContract }));

import { inspectContract } from "./inspect-contract.js";

const contractId = `C${"A".repeat(55)}`;
const artifactWasmPath = "./deploy/mainnet-wasm/token.wasm";
const configuredWasmPath = "/tmp/app/contracts/token/target/testnet.wasm";
const config: CaatingaConfig = {
  project: "app",
  defaultNetwork: "mainnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./contracts/token/target/testnet.wasm",
      dependsOn: [],
      deployArgs: {},
    },
  },
  networks: {
    mainnet: {
      rpcUrl: "https://rpc.example.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
};

describe("inspectContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveContract.mockReturnValue({
      name: "token",
      config: config.contracts.token,
      sourcePath: "/tmp/app/contracts/token",
      wasmPath: configuredWasmPath,
    });
    readArtifacts.mockResolvedValue({
      project: "app",
      version: 2,
      networks: {
        mainnet: {
          contracts: {
            token: {
              contractId,
              wasmHash: "a".repeat(64),
              deployedAt: "2026-09-24T00:00:00.000Z",
              sourcePath: "./contracts/token",
              wasmPath: artifactWasmPath,
              dependencies: [],
              resolvedDeployArgs: {},
            },
          },
          dependencyGraph: {},
        },
      },
    });
    checkBinary.mockResolvedValue(undefined);
    verifyDependencyContract.mockResolvedValue(undefined);
    resolveWasmArtifactPath.mockResolvedValue("/tmp/app/deploy/mainnet-wasm/token.wasm");
    hashWasm.mockResolvedValue("a".repeat(64));
  });

  it("uses the selected network artifact WASM path", async () => {
    const result = await inspectContract({ config, contractName: "token", cwd: "/tmp/app" });

    expect(resolveWasmArtifactPath).toHaveBeenCalledWith(
      "/tmp/app/deploy/mainnet-wasm/token.wasm",
      {
        sourcePath: "/tmp/app/contracts/token",
      }
    );
    expect(result.localWasm).toEqual({
      path: "/tmp/app/deploy/mainnet-wasm/token.wasm",
      hash: "a".repeat(64),
      matchesArtifact: true,
    });
  });

  it("falls back to the configured contract WASM when the artifact path is missing", async () => {
    resolveWasmArtifactPath
      .mockRejectedValueOnce(new Error("artifact WASM no longer exists"))
      .mockResolvedValueOnce(configuredWasmPath);
    hashWasm.mockResolvedValue("b".repeat(64));

    const result = await inspectContract({ config, contractName: "token", cwd: "/tmp/app" });

    expect(resolveWasmArtifactPath).toHaveBeenNthCalledWith(
      1,
      "/tmp/app/deploy/mainnet-wasm/token.wasm",
      {
        sourcePath: "/tmp/app/contracts/token",
      }
    );
    expect(resolveWasmArtifactPath).toHaveBeenNthCalledWith(2, configuredWasmPath, {
      sourcePath: "/tmp/app/contracts/token",
    });
    expect(result.localWasm).toEqual({
      path: configuredWasmPath,
      hash: "b".repeat(64),
      matchesArtifact: false,
    });
  });

  it("includes inspection diagnostics without deploy-only guidance in detail", async () => {
    verifyDependencyContract.mockRejectedValue(
      new CaatingaError(
        'Dependency "token" is not deployed on "mainnet".',
        CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        "Deploy the dependency or omit --verify-deps.\n\nStellar CLI diagnostics:\ncontract not found on ledger",
        new CaatingaError(
          "Command failed: stellar contract fetch",
          CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
          "contract not found on ledger"
        )
      )
    );

    const result = await inspectContract({ config, contractName: "token", cwd: "/tmp/app" });

    expect(result.onChain.detail).toContain('Dependency "token" is not deployed on "mainnet".');
    expect(result.onChain.detail).toContain("contract not found on ledger");
    expect(result.onChain.detail).not.toContain("omit --verify-deps");
  });
});
