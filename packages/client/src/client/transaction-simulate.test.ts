import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core/browser";
import { normalizeSimulationValue, readSimulationResult } from "./transaction-simulate.js";

describe("transaction-simulate", () => {
  it("should_unwrap_ok_results_from_stellar_bindings", () => {
    const value = {
      isOk: () => true,
      isErr: () => false,
      unwrap: () => true,
      unwrapErr: () => {
        throw new Error("not err");
      },
    };

    expect(normalizeSimulationValue<boolean>(value, "verifier", "verify_proof")).toBe(true);
  });

  it("should_throw_when_stellar_result_is_err", () => {
    const value = {
      isOk: () => false,
      isErr: () => true,
      unwrap: () => {
        throw new Error("not ok");
      },
      unwrapErr: () => ({ message: "MalformedVerifyingKey" }),
    };

    expect(() => normalizeSimulationValue(value, "verifier", "verify_proof")).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.XDR_RESULT_FAILED,
        message: expect.stringContaining("MalformedVerifyingKey"),
      })
    );
  });

  it("should_read_simulation_result_from_assembled_transaction", () => {
    const raw = {
      result: {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => false,
        unwrapErr: () => {
          throw new Error("not err");
        },
      },
    };

    expect(readSimulationResult<boolean>(raw, "verifier", "verify_proof")).toBe(false);
  });
});
