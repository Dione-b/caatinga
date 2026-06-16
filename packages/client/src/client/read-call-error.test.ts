import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { enrichReadCallInvokeError } from "./read-call-error.js";

describe("enrichReadCallInvokeError", () => {
  it("should_map_read_call_failures_to_actionable_hints", () => {
    const error = new CaatingaError(
      "submit failed",
      CaatingaErrorCode.XDR_SUBMIT_FAILED,
      "This is a read call. Use force: true to sign and send anyway."
    );

    const enriched = enrichReadCallInvokeError(error, "app", "greet");

    expect(enriched).toMatchObject({
      code: CaatingaErrorCode.XDR_SUBMIT_FAILED,
      hint: expect.stringContaining('client.contract("app").read("greet")')
    });
    expect(enriched?.hint).toContain("Pass method args as the second argument to read()");
  });

  it("should_return_null_for_unrelated_errors", () => {
    const error = new Error("network timeout");

    expect(enrichReadCallInvokeError(error, "app", "greet")).toBeNull();
  });
});
