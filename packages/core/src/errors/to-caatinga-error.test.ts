import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "./CaatingaErrorCode.js";
import { toCaatingaError } from "./CaatingaError.js";

describe("toCaatingaError", () => {
  it("should_normalize_Error_instances_to_UNEXPECTED_ERROR", () => {
    expect(toCaatingaError(new Error("boom")).code).toBe(CaatingaErrorCode.UNEXPECTED_ERROR);
  });

  it("should_map_ZkError_ZK_VERIFY_FAILED_to_ZK_VERIFICATION_FAILED", () => {
    const zkError = Object.assign(new Error("Verifier returned false."), {
      code: "ZK_VERIFY_FAILED",
      hint: "Check your proof inputs.",
    });
    const result = toCaatingaError(zkError);
    expect(result.code).toBe(CaatingaErrorCode.ZK_VERIFICATION_FAILED);
    expect(result.message).toBe("Verifier returned false.");
    expect(result.hint).toBe("Check your proof inputs.");
  });
});
