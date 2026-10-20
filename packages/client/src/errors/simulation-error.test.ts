import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { classifySimulationError, toSimulationError } from "./simulation-error.js";

function classify(error: unknown) {
  return classifySimulationError(error, "counter", "increment", "https://rpc.example")?.code;
}

describe("classifySimulationError", () => {
  it.each([
    ["Account not found: GABC", CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND],
    ["ACCOUNT_NOT_FOUND", CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND],
    ["transaction failed: txNO_ACCOUNT", CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND],
    [
      'Transaction simulation failed: "HostError: Error(Budget, ExceededLimit)"',
      CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT,
    ],
    ["INVOKE_HOST_FUNCTION_RESOURCE_LIMIT_EXCEEDED", CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT],
    ["tx failed: txINSUFFICIENT_FEE", CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT],
    ["INVOKE_HOST_FUNCTION_ENTRY_ARCHIVED", CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED],
    [
      "You need to restore some contract state before you can invoke this method.",
      CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED,
    ],
  ])("should_classify_%s", (message, code) => {
    expect(classify(new Error(message))).toBe(code);
  });

  it("should_classify_a_non_null_restorePreamble_as_archived", () => {
    expect(classify({ error: "simulation", restorePreamble: { minResourceFee: "100" } })).toBe(
      CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED
    );
    expect(classify({ simulation: { restorePreamble: { minResourceFee: "1" } } })).toBe(
      CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED
    );
  });

  it.each([
    ["an HTTP rate limit", new Error("Request failed with status code 429: rate limit exceeded")],
    ["a null restorePreamble field", { error: "boom", restorePreamble: null }],
    ["a generic not found", new Error("contract method not found")],
    ["a transport error", new Error("socket hang up")],
  ])("should_not_classify_%s", (_label, error) => {
    expect(classify(error)).toBeUndefined();
  });

  it("should_not_read_field_names_as_evidence", () => {
    expect(classify({ restorePreamble: undefined, message: "boom" })).toBeUndefined();
  });

  it("should_survive_throwing_getters_and_cycles", () => {
    const error: Record<string, unknown> = {
      get result(): unknown {
        throw new Error("getter");
      },
      message: "Account not found: GABC",
    };
    error.cause = error;

    expect(classify(error)).toBe(CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND);
  });

  it("should_keep_caatinga_errors_other_than_XDR_PREPARE_FAILED", () => {
    const error = new CaatingaError(
      "Account not found",
      CaatingaErrorCode.WALLET_NOT_CONNECTED,
      "connect"
    );

    expect(classify(error)).toBeUndefined();
    expect(toSimulationError(error, "counter", "increment", "https://rpc.example")).toBe(error);
  });

  it("should_keep_the_original_error_as_cause", () => {
    const original = new Error("Account not found: GABC");

    expect(
      classifySimulationError(original, "counter", "increment", "https://rpc.example")
    ).toMatchObject({ cause: original, hint: expect.stringContaining("https://rpc.example") });
  });
});

describe("toSimulationError", () => {
  it("should_fall_back_to_XDR_PREPARE_FAILED_with_the_action_in_the_message", () => {
    expect(
      toSimulationError(new Error("boom"), "counter", "increment", "https://rpc.example", "prepare")
    ).toMatchObject({
      code: CaatingaErrorCode.XDR_PREPARE_FAILED,
      message: expect.stringContaining("Failed to prepare XDR"),
    });
  });
});
