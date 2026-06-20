import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";

describe("resolveDeployArgs", () => {
  const tokenContractId = "CTOKENCONTRACTID";
  const artifacts = {
    project: "marketplace-app",
    version: 1 as const,
    networks: {
      testnet: {
        contracts: {
          token: {
            contractId: tokenContractId,
            wasmHash: "hash",
            deployedAt: "2026-05-12T00:00:00.000Z",
            sourcePath: "./contracts/token",
            wasmPath: "./token.wasm",
            dependencies: [],
            resolvedDeployArgs: {},
          },
        },
        dependencyGraph: {
          token: [],
        },
      },
    },
  };

  it("resolves contractId placeholders from artifacts", () => {
    const marketplaceConfig = {
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}",
      },
    };

    const result = resolveDeployArgs({
      deployArgs: marketplaceConfig.deployArgs,
      artifacts,
      network: "testnet",
    });

    expect(result).toEqual({
      tokenContractId,
    });
  });

  it("rejects unsupported placeholders", () => {
    expect(() =>
      resolveDeployArgs({
        deployArgs: { secret: "${env.SECRET}" },
        artifacts,
        network: "testnet",
      })
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID })
    );
  });

  it("fails when dependency artifact is missing", () => {
    expect(() =>
      resolveDeployArgs({
        deployArgs: { tokenContractId: "${contracts.missing.contractId}" },
        artifacts,
        network: "testnet",
      })
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND })
    );
  });
});
