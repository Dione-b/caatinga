import { describe, expect, it } from "vitest";
import type { ContractConfig } from "./config.schema.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { validateContractGraph } from "./validate-contract-graph.js";

function contract(
  overrides: Partial<ContractConfig> & Pick<ContractConfig, "path" | "wasm">
): ContractConfig {
  return {
    dependsOn: [],
    deployArgs: {},
    ...overrides,
  };
}

describe("validateContractGraph", () => {
  it("should_pass_when_dependsOn_and_deployArgs_are_aligned", () => {
    expect(() =>
      validateContractGraph({
        token: contract({ path: "./token", wasm: "./token.wasm" }),
        marketplace: contract({
          path: "./marketplace",
          wasm: "./marketplace.wasm",
          dependsOn: ["token"],
          deployArgs: {
            tokenContractId: "${contracts.token.contractId}",
          },
        }),
      })
    ).not.toThrow();
  });

  it("should_pass_when_deployArgs_use_source_address_without_contract_deps", () => {
    expect(() =>
      validateContractGraph({
        counter: contract({
          path: "./counter",
          wasm: "./counter.wasm",
          deployArgs: { admin: "${source.address}" },
        }),
      })
    ).not.toThrow();
  });

  it("should_throw_CONTRACT_DEPENDENCY_NOT_FOUND_when_dependsOn_references_missing_contract", () => {
    expect(() =>
      validateContractGraph({
        marketplace: contract({
          path: "./marketplace",
          wasm: "./marketplace.wasm",
          dependsOn: ["token"],
        }),
      })
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND })
    );
  });

  it("should_throw_CONTRACT_DEPENDENCY_CYCLE_when_dependsOn_forms_a_cycle", () => {
    expect(() =>
      validateContractGraph({
        a: contract({ path: "./a", wasm: "./a.wasm", dependsOn: ["b"] }),
        b: contract({ path: "./b", wasm: "./b.wasm", dependsOn: ["a"] }),
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_CYCLE }));
  });

  it("should_throw_INVALID_CONFIG_when_deployArgs_reference_contract_not_in_dependsOn", () => {
    expect(() =>
      validateContractGraph({
        token: contract({ path: "./token", wasm: "./token.wasm" }),
        marketplace: contract({
          path: "./marketplace",
          wasm: "./marketplace.wasm",
          dependsOn: [],
          deployArgs: {
            tokenContractId: "${contracts.token.contractId}",
          },
        }),
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.INVALID_CONFIG }));
  });

  it("should_throw_CONTRACT_DEPENDENCY_NOT_FOUND_when_deployArgs_reference_unknown_contract", () => {
    expect(() =>
      validateContractGraph({
        marketplace: contract({
          path: "./marketplace",
          wasm: "./marketplace.wasm",
          dependsOn: ["ghost"],
          deployArgs: {
            tokenContractId: "${contracts.ghost.contractId}",
          },
        }),
      })
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND })
    );
  });
});
