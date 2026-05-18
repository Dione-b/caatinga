import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";
import {
  verifyDependencyContract,
  verifyDependencyContracts
} from "./verify-dependency-contract.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand
}));

const network: ResolvedNetwork = {
  name: "testnet",
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  }
};

const tokenId = "C".padEnd(56, "A");

function createTokenArtifact(contractId: string): CaatingaArtifacts["networks"][string]["contracts"][string] {
  return {
    contractId,
    wasmHash: "a".repeat(64),
    deployedAt: "2026-05-12T00:00:00.000Z",
    sourcePath: "./contracts/token",
    wasmPath: "./contracts/token/target/wasm32-unknown-unknown/release/token.wasm",
    dependencies: [],
    resolvedDeployArgs: {}
  };
}

const artifacts: CaatingaArtifacts = {
  project: "marketplace-app",
  version: 1,
  networks: {
    testnet: {
      contracts: {
        token: createTokenArtifact(tokenId)
      },
      dependencyGraph: {}
    }
  }
};

describe("verifyDependencyContract", () => {
  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({ stdout: "", stderr: "", all: "" });
  });

  it("should_call_stellar_contract_info_interface_with_contract_id", async () => {
    await verifyDependencyContract({
      dependencyName: "token",
      contractId: tokenId,
      network,
      cwd: "/tmp/app"
    });

    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      [
        "contract",
        "info",
        "interface",
        "--contract-id",
        tokenId,
        "--network",
        "testnet"
      ],
      expect.objectContaining({
        cwd: "/tmp/app",
        failureCode: CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND
      })
    );
  });

  it("should_throw_DEPENDENCY_CONTRACT_NOT_FOUND_when_stellar_contract_info_fails", async () => {
    runCommand.mockRejectedValue(
      new CaatingaError(
        "Command failed: stellar contract info interface",
        CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        "contract not found on ledger"
      )
    );

    await expect(
      verifyDependencyContract({
        dependencyName: "token",
        contractId: tokenId,
        network
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
      message: expect.stringContaining("token")
    });
  });
});

describe("verifyDependencyContracts", () => {
  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({ stdout: "", stderr: "", all: "" });
  });

  it("should_verify_each_configured_dependency", async () => {
    await verifyDependencyContracts({
      dependencies: ["token"],
      artifacts,
      network,
      cwd: "/tmp/app"
    });

    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  it("should_throw_CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND_when_artifact_missing", async () => {
    await expect(
      verifyDependencyContracts({
        dependencies: ["token"],
        artifacts: {
          project: "marketplace-app",
          version: 1,
          networks: { testnet: { contracts: {}, dependencyGraph: {} } }
        },
        network
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND });
  });
});
