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
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    },
  },
};

describe("resolveContractId", () => {
  it("uses explicit contract id before artifacts", () => {
    const contractId = resolveContractId({
      artifacts,
      network: "testnet",
      contract: "counter",
      explicitContractId: "CEXPLICIT00000000000000000000000000000000000000000000000",
    });

    expect(contractId).toBe("CEXPLICIT00000000000000000000000000000000000000000000000");
  });

  it("resolves contract id from network artifacts", () => {
    const contractId = resolveContractId({
      artifacts,
      network: "testnet",
      contract: "counter",
    });

    expect(contractId).toBe("CCOUNTER000000000000000000000000000000000000000000000000");
  });

  it("throws when no matching contract artifact exists", () => {
    expect(() =>
      resolveContractId({
        artifacts,
        network: "testnet",
        contract: "token",
      })
    ).toThrowError(CaatingaError);

    try {
      resolveContractId({ artifacts, network: "testnet", contract: "token" });
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      expect((error as CaatingaError).code).toBe(CaatingaErrorCode.CONTRACT_ARTIFACT_NOT_FOUND);
    }
  });

  it("explains that empty artifacts need deploy rather than build", () => {
    const emptyArtifacts: CaatingaArtifacts = {
      project: "counter-app",
      version: 1,
      networks: {},
    };

    expect(() =>
      resolveContractId({
        artifacts: emptyArtifacts,
        network: "testnet",
        contract: "counter",
      })
    ).toThrowError(/No contract artifact found/);

    try {
      resolveContractId({ artifacts: emptyArtifacts, network: "testnet", contract: "counter" });
    } catch (error) {
      expect((error as CaatingaError).hint).toContain("ctg doctor --network testnet");
      expect((error as CaatingaError).hint).toContain("ctg build does not register a contract ID");
    }
  });

  it("explains when the selected network is missing from artifacts", () => {
    try {
      resolveContractId({ artifacts, network: "mainnet", contract: "counter" });
    } catch (error) {
      expect((error as CaatingaError).hint).toContain(
        "ctg deploy counter --network mainnet --source <identity>"
      );
      expect((error as CaatingaError).hint).toContain("ctg build does not register a contract ID");
    }
  });

  it("explains when a contract has not been deployed on an existing network", () => {
    try {
      resolveContractId({ artifacts, network: "testnet", contract: "token" });
    } catch (error) {
      expect((error as CaatingaError).hint).toContain(
        'Contract "token" is not deployed on "testnet"'
      );
      expect((error as CaatingaError).hint).toContain("pass contractId in the client registration");
    }
  });
});
