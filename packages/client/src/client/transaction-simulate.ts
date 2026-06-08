import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import type { SimulateTransactionLike } from "./transaction-types.js";

export async function prepareReadTransaction(
  transaction: unknown,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SimulateTransactionLike;

  if (typeof candidate.prepare !== "function") {
    return transaction;
  }

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

export function readSimulationResult<T>(raw: unknown, contractName: string, method: string): T {
  if (raw !== null && typeof raw === "object" && "result" in raw) {
    const result = (raw as { result?: T }).result;
    if (result !== undefined) {
      return result;
    }
  }

  throw new CaatingaError(
    `Simulation for "${contractName}.${method}" did not return a result.`,
    CaatingaErrorCode.READ_RESULT_MISSING,
    `Expected "${contractName}.${method}" to expose a simulation result. Use debugRaw to inspect the generated binding output.`
  );
}
