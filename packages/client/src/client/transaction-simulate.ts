import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import type { SimulateTransactionLike } from "./transaction-types.js";

type StellarContractResult = {
  isOk: () => boolean;
  isErr: () => boolean;
  unwrap: () => unknown;
  unwrapErr: () => unknown;
};

export async function prepareReadTransaction(
  transaction: unknown,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SimulateTransactionLike;

  if (typeof candidate.prepare === "function") {
    try {
      return await candidate.prepare.call(transaction);
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to prepare XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_PREPARE_FAILED,
        `RPC: ${rpcUrl}. Check connectivity, simulation errors, and binding compatibility.`,
        error
      );
    }
  }

  if (typeof candidate.simulate === "function") {
    try {
      return await candidate.simulate.call(transaction);
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to simulate "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_PREPARE_FAILED,
        `RPC: ${rpcUrl}. Check connectivity, simulation errors, and binding compatibility.`,
        error
      );
    }
  }

  return transaction;
}

function isStellarContractResult(value: unknown): value is StellarContractResult {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as StellarContractResult).isOk === "function" &&
    typeof (value as StellarContractResult).unwrap === "function"
  );
}

export function normalizeSimulationValue<T>(
  value: unknown,
  contractName: string,
  method: string
): T {
  if (!isStellarContractResult(value)) {
    return value as T;
  }

  if (value.isErr()) {
    const err = value.unwrapErr();
    const message =
      err !== null && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);

    throw new CaatingaError(
      `Simulation for "${contractName}.${method}" returned a contract error: ${message}.`,
      CaatingaErrorCode.XDR_RESULT_FAILED,
      "Check contract inputs and binding argument encoding.",
      err
    );
  }

  return value.unwrap() as T;
}

export function readSimulationResult<T>(raw: unknown, contractName: string, method: string): T {
  if (raw !== null && typeof raw === "object" && "result" in raw) {
    const result = (raw as { result?: unknown }).result;
    if (result !== undefined) {
      return normalizeSimulationValue<T>(result, contractName, method);
    }
  }

  throw new CaatingaError(
    `Simulation for "${contractName}.${method}" did not return a result.`,
    CaatingaErrorCode.READ_RESULT_MISSING,
    `Expected "${contractName}.${method}" to expose a simulation result. Use debugRaw to inspect the generated binding output.`
  );
}
