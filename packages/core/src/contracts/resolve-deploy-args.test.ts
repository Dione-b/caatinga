import { describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";

const resolveSourceAddressMock = vi.hoisted(() => vi.fn());

vi.mock("./resolve-source-address.js", () => ({
  resolveSourceAddress: resolveSourceAddressMock,
}));

describe("resolveDeployArgs", () => {
  const tokenContractId = "CTOKENCONTRACTID";
  const deployerAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
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

  it("resolves contractId placeholders from artifacts", async () => {
    const result = await resolveDeployArgs({
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}",
      },
      artifacts,
      network: "testnet",
    });

    expect(result).toEqual({
      tokenContractId,
    });
  });

  it("resolves source.address placeholders from the deploy identity", async () => {
    resolveSourceAddressMock.mockResolvedValueOnce(deployerAddress);

    const result = await resolveDeployArgs({
      deployArgs: {
        admin: "${source.address}",
        minter: "${source.address}",
      },
      artifacts,
      network: "testnet",
      source: "deployer",
      cwd: "/tmp/app",
    });

    expect(resolveSourceAddressMock).toHaveBeenCalledWith({
      source: "deployer",
      cwd: "/tmp/app",
    });
    expect(result).toEqual({
      admin: deployerAddress,
      minter: deployerAddress,
    });
  });

  it("rejects unsupported placeholders", async () => {
    await expect(
      resolveDeployArgs({
        deployArgs: { secret: "${env.SECRET}" },
        artifacts,
        network: "testnet",
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID });
  });

  it("fails when dependency artifact is missing", async () => {
    await expect(
      resolveDeployArgs({
        deployArgs: { tokenContractId: "${contracts.missing.contractId}" },
        artifacts,
        network: "testnet",
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND });
  });

  it("fails when source.address is used without a source identity", async () => {
    await expect(
      resolveDeployArgs({
        deployArgs: { admin: "${source.address}" },
        artifacts,
        network: "testnet",
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED });
  });
});
