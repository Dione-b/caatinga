import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "./CaatingaErrorCode.js";
import { toCaatingaError } from "./CaatingaError.js";

describe("toCaatingaError", () => {
  it("should_normalize_Error_instances_to_UNEXPECTED_ERROR", () => {
    expect(toCaatingaError(new Error("boom")).code).toBe(CaatingaErrorCode.UNEXPECTED_ERROR);
  });

  it("should_map_ZkError_ZK_DEV_CEREMONY_BLOCKED", () => {
    const zkError = Object.assign(new Error("blocked on mainnet"), {
      code: "ZK_DEV_CEREMONY_BLOCKED",
      hint: "Use testnet.",
    });
    const result = toCaatingaError(zkError);
    expect(result.code).toBe(CaatingaErrorCode.ZK_DEV_CEREMONY_BLOCKED);
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

  it.each([
    ["ZK_VK_REQUIRED", CaatingaErrorCode.ZK_VK_REQUIRED],
    ["ZK_INVOKE_FAILED", CaatingaErrorCode.ZK_INVOKE_FAILED],
    ["ZK_DOWNLOAD_FAILED", CaatingaErrorCode.ZK_DOWNLOAD_FAILED],
    ["ZK_UNSUPPORTED_PLATFORM", CaatingaErrorCode.ZK_UNSUPPORTED_PLATFORM],
  ])("should_map_ZkError_%s", (sourceCode, expectedCode) => {
    const result = toCaatingaError(Object.assign(new Error("zk failure"), { code: sourceCode }));

    expect(result.code).toBe(expectedCode);
  });
});
