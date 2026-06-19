import { describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core/browser";
import {
  assertSubmitResultRecognized,
  normalizeSubmitResult,
  submitTransaction
} from "./transaction-submit.js";

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
  it("should_throw_XDR_RESULT_FAILED_for_unrecognized_payload", () => {
    expect(() => assertSubmitResultRecognized({ unknown: true }, "counter", "increment")).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.XDR_RESULT_FAILED })
    );
  });
});

function makeSentTransaction(hash: string, result: unknown): unknown {
  return {
    sendTransactionResponse: { hash, status: "PENDING" },
    getTransactionResponse: { status: "SUCCESS" },
    get result() {
      return result;
    }
  };
}

describe("submitTransaction — SDK v16 SentTransaction", () => {
  const signTransaction = vi.fn(async (xdr: string) => ({ signedTxXdr: "SIGNED_" + xdr }));

  it("normalizes sendTransactionResponse.hash and result getter", async () => {
    const tx = {
      async signAndSend() {
        return makeSentTransaction("abc123", 42);
      }
    };
    const raw = await submitTransaction(
      tx,
      signTransaction,
      "counter",
      "increment",
      "https://rpc.example"
    );
    const normalized = normalizeSubmitResult<number>(raw);
    expect(normalized.transactionHash).toBe("abc123");
    expect(normalized.result).toBe(42);
  });

  it("assertSubmitResultRecognized accepts a SentTransaction", () => {
    expect(() =>
      assertSubmitResultRecognized(makeSentTransaction("h", 1), "counter", "increment")
    ).not.toThrow();
  });

  it("maps NeedsMoreSignaturesError to CAATINGA_MULTI_AUTH_REQUIRED", async () => {
    const tx = {
      async signAndSend() {
        const err = new Error("Transaction requires signatures from GOTHER…");
        err.name = "NeedsMoreSignaturesError";
        throw err;
      }
    };
    await expect(
      submitTransaction(tx, signTransaction, "counter", "increment", "https://rpc.example")
    ).rejects.toMatchObject({ code: CaatingaErrorCode.MULTI_AUTH_REQUIRED });
  });
});
