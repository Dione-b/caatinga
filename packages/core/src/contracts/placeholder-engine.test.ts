import { describe, it, expect } from "vitest";
import { resolvePlaceholders, type PlaceholderContext } from "./placeholder-engine.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";

describe("resolvePlaceholders", () => {
  const context: PlaceholderContext = {
    artifacts: {
      project: "my-app",
      version: 2,
      networks: {
        testnet: {
          dependencyGraph: {},
          contracts: {
            token: {
              contractId: "CAS3JIO4YZHG45NVU",
              wasmHash: "hash-token",
              deployedAt: "2026-07-06T10:00:00Z",
              sourcePath: "contracts/token",
              wasmPath: "token.wasm",
              dependencies: [],
              resolvedDeployArgs: {},
            },
          },
        },
      },
    },
    network: "testnet",
    sourceAddress: "GAA123SOURCEADDRESS",
  };

  it("should resolve single contractId placeholder", () => {
    const result = resolvePlaceholders("${contracts.token.contractId}", context);
    expect(result).toBe("CAS3JIO4YZHG45NVU");
  });

  it("should resolve single source.address placeholder", () => {
    const result = resolvePlaceholders("${source.address}", context);
    expect(result).toBe("GAA123SOURCEADDRESS");
  });

  it("should resolve inline placeholders within a text string", () => {
    const result = resolvePlaceholders(
      "Contract ${contracts.token.contractId} deployed by ${source.address}",
      context
    );
    expect(result).toBe("Contract CAS3JIO4YZHG45NVU deployed by GAA123SOURCEADDRESS");
  });

  it("should throw CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND when contract artifact is missing", () => {
    expect(() =>
      resolvePlaceholders("${contracts.missing.contractId}", context)
    ).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND,
      })
    );
  });

  it("should throw SOURCE_ADDRESS_UNRESOLVED when sourceAddress is missing", () => {
    const noSourceContext = { ...context, sourceAddress: undefined };
    expect(() =>
      resolvePlaceholders("${source.address}", noSourceContext)
    ).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
      })
    );
  });

  it("should throw DEPLOY_ARG_PLACEHOLDER_INVALID for malformed or unsupported placeholders", () => {
    expect(() =>
      resolvePlaceholders("Some ${invalid.placeholder} here", context)
    ).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID,
      })
    );
  });
});
