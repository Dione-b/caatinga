import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import type { StellarSdkSignTransaction, SubmitTransactionLike } from "./transaction-types.js";

export async function submitTransaction(
  transaction: unknown,
  signTransaction: StellarSdkSignTransaction,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SubmitTransactionLike;

  if (typeof candidate.signAndSend === "function") {
    try {
      const raw = await candidate.signAndSend.call(transaction, { signTransaction });
      assertSubmitResultRecognized(raw, contractName, method);
      return raw;
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to submit XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_SUBMIT_FAILED,
        `RPC: ${rpcUrl}. Check wallet signature and RPC connectivity.`,
        error
      );
    }
  }

  if (typeof candidate.send === "function") {
    try {
      const raw = await candidate.send.call(transaction);
      assertSubmitResultRecognized(raw, contractName, method);
      return raw;
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to submit XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_SUBMIT_FAILED,
        `RPC: ${rpcUrl}. Check wallet signature and RPC connectivity.`,
        error
      );
    }
  }

  throw new CaatingaError(
    `Binding transaction for "${contractName}.${method}" cannot be submitted.`,
    CaatingaErrorCode.XDR_SUBMIT_FAILED,
    "Regenerate bindings or provide a compatible binding adapter."
  );
}

export function assertSubmitResultRecognized(raw: unknown, contractName: string, method: string): void {
  if (raw === null || typeof raw !== "object") {
    return;
  }

  const record = raw as Record<string, unknown>;
  const hasTransactionId =
    "txHash" in record ||
    "transactionHash" in record ||
    "hash" in record ||
    hasNestedSendTransactionResponseHash(record);
  const hasResult = "result" in record;

  if (hasTransactionId || hasResult) {
    return;
  }

  throw new CaatingaError(
    `Submit returned an unrecognized payload for "${contractName}.${method}".`,
    CaatingaErrorCode.XDR_RESULT_FAILED,
    "Expected txHash, transactionHash, hash, sendTransactionResponse.hash, or result on the submit response. Use debugRaw to inspect the binding output."
  );
}

function hasNestedSendTransactionResponseHash(record: Record<string, unknown>): boolean {
  const response = record.sendTransactionResponse;
  return response !== null && typeof response === "object" && "hash" in response;
}

export function normalizeSubmitResult<T>(raw: unknown): {
  transactionHash?: string;
  result?: T;
} {
  const candidate = raw as {
    txHash?: string;
    transactionHash?: string;
    hash?: string;
    sendTransactionResponse?: {
      hash?: string;
    };
    result?: T;
  };

  return {
    transactionHash:
      candidate.txHash ??
      candidate.transactionHash ??
      candidate.hash ??
      candidate.sendTransactionResponse?.hash,
    result: candidate.result
  };
}
