import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core/browser";
import { normalizeSubmitResult } from "./transaction-submit.js";

describe("normalizeSubmitResult", () => {
  it("should_prefer_txHash_over_other_hash_fields", () => {
    const normalized = normalizeSubmitResult({
      txHash: "tx-primary",
      transactionHash: "tx-secondary",
      hash: "tx-tertiary"
    });

    expect(normalized.transactionHash).toBe("tx-primary");
  });

  it("should_read_nested_sendTransactionResponse_hash", () => {
    const normalized = normalizeSubmitResult({
      sendTransactionResponse: { hash: "nested-hash" }
    });

    expect(normalized.transactionHash).toBe("nested-hash");
  });

  it("should_preserve_result_field", () => {
    const normalized = normalizeSubmitResult<{ value: number }>({
      result: { value: 42 },
      hash: "abc"
    });

    expect(normalized.result).toEqual({ value: 42 });
    expect(normalized.transactionHash).toBe("abc");
  });
});

describe("assertSubmitResultRecognized", () => {
  it("should_throw_XDR_RESULT_FAILED_for_unrecognized_payload", async () => {
    const { assertSubmitResultRecognized } = await import("./transaction-submit.js");

    expect(() => assertSubmitResultRecognized({ unknown: true }, "counter", "increment")).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.XDR_RESULT_FAILED })
    );
  });
});
