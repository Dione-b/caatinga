import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode, type CaatingaArtifacts } from "@caatinga/core/browser";
import { resolveContractId } from "./resolve-contract-id.js";

const artifacts: CaatingaArtifacts = {
  project: "counter-app",
  version: 1,
  networks: {
    testnet: {
      contracts: {
        counter: {
          contractId: "CCOUNTER000000000000000000000000000000000000000000000000",
          wasmHash: "hash",
          deployedAt: "2026-05-12T00:00:00.000Z",
          sourcePath: "contracts/counter",
          wasmPath: "target/wasm32v1-none/release/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {}
        }
      },
      dependencyGraph: {}
    }
  }
};

describe("resolveContractId", () => {
  it("uses explicit contract id before artifacts", () => {
    const contractId = resolveContractId({
      artifacts,
      network: "testnet",
      contract: "counter",
      explicitContractId: "CEXPLICIT00000000000000000000000000000000000000000000000"
    });

    expect(contractId).toBe("CEXPLICIT00000000000000000000000000000000000000000000000");
  });

  it("resolves contract id from network artifacts", () => {
    const contractId = resolveContractId({
      artifacts,
      network: "testnet",
      contract: "counter"
    });

    expect(contractId).toBe("CCOUNTER000000000000000000000000000000000000000000000000");
  });

  it("throws when no matching contract artifact exists", () => {
    expect(() =>
      resolveContractId({
        artifacts,
        network: "testnet",
        contract: "token"
      })
    ).toThrowError(CaatingaError);

    try {
      resolveContractId({ artifacts, network: "testnet", contract: "token" });
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      expect((error as CaatingaError).code).toBe(CaatingaErrorCode.CONTRACT_ARTIFACT_NOT_FOUND);
    }
  });
});
