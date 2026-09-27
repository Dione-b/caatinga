import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import type { SimulateTransactionLike } from "./transaction-types.js";

type StellarContractResult = {
  isOk: () => boolean;
  isErr: () => boolean;
  unwrap: () => unknown;
  unwrapErr: () => unknown;
};

type SimulationFailure = {
  code:
    | typeof CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND
    | typeof CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT
    | typeof CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED;
  message: string;
  hint: string;
};

const ARCHIVED_ENTRY_PATTERNS = [
  /ENTRY_ARCHIVED|ARCHIVED.{0,50}ENTR|ENTR(?:Y|IES).{0,50}ARCHIVED/,
  /(?:STORAGE|LEDGER).{0,30}ARCHIVED/,
  /EXPIRED.?STATE|RESTORE.?PREAMBLE|RESTORE.{0,35}(?:ARCHIVED|EXPIRED|CONTRACT STATE)/,
];
const MISSING_ACCOUNT_PATTERNS = [
  /ACCOUNT_NOT_FOUND|ACCOUNT.?NOT.?FOUND/,
  /TX_?NO_ACCOUNT|OP_?NO_ACCOUNT/,
  /ACCOUNT.{0,60}(?:NOT.{0,12}FOUND|DOES NOT EXIST|UNFUNDED|NOT FUNDED)/,
  /NOT.{0,12}FOUND.{0,60}ACCOUNT/,
];
const RESOURCE_LIMIT_PATTERNS = [
  /RESOURCE_LIMIT|RESOURCE.{0,25}LIMIT|LIMIT.{0,25}RESOURCE|LIMIT.?EXCEEDED/,
  /HOSTERROR\(BUDGET|INSTRUCTION.{0,30}EXCEEDED|MEMORY.{0,30}EXCEEDED/,
  /INSUFFICIENT.{0,30}(?:FEE|RESOURCE)/,
  /(?:FEE|RESOURCE).{0,30}(?:INSUFFICIENT|TOO LOW|LOWER|BELOW|EXCEEDED)/,
  /(?:FEE|RESOURCE)_?(?:TOO_?LOW|BELOW|INSUFFICIENT)/,
  /SOROBANINVALID.{0,40}RESOURCEFEE/,
];

function collectErrorText(value: unknown, seen = new Set<object>(), depth = 0): string {
  if (depth > 4 || value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value !== "object" || seen.has(value)) {
    return "";
  }

  seen.add(value);

  const fields = [
    "name",
    "code",
    "message",
    "hint",
    "error",
    "details",
    "detail",
    "data",
    "response",
    "result",
    "cause",
    "simulation",
    "diagnostics",
    "diagnosticEvents",
    "restorePreamble",
  ];
  const text = fields
    .filter((field) => field in value)
    .flatMap((field) => [
      field,
      collectErrorText((value as Record<string, unknown>)[field], seen, depth + 1),
    ])
    .filter(Boolean);

  try {
    const serialized = JSON.stringify(value);
    if (serialized) {
      text.push(serialized);
    }
  } catch {
    // The named fields above still provide useful information for cyclic SDK/RPC errors.
  }

  return text.join(" ");
}

function classifySimulationFailure(error: unknown): SimulationFailure | undefined {
  const evidence = collectErrorText(error).toUpperCase();

  if (ARCHIVED_ENTRY_PATTERNS.some((pattern) => pattern.test(evidence))) {
    return {
      code: CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED,
      message: "Simulation requires restoration of archived Soroban contract state.",
      hint: [
        "For a write, retry with invoke(method, args, { restore: true }) and a compatible binding.",
        "If RPC returns restorePreamble, the binding may request approval and submit RestoreFootprint.",
        "When present, restorePreamble is retained on error.cause for manual restoration.",
        "For a read, use the preamble's fee and transaction data to submit a separate restore transaction.",
        "Then retry the read.",
      ].join(" "),
    };
  }

  if (MISSING_ACCOUNT_PATTERNS.some((pattern) => pattern.test(evidence))) {
    return {
      code: CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND,
      message: "The wallet source account does not exist on the selected Stellar network.",
      hint: [
        "Fund this Stellar account with enough XLM to create it and cover transaction fees,",
        "or use an existing funded account, then retry.",
      ].join(" "),
    };
  }

  if (RESOURCE_LIMIT_PATTERNS.some((pattern) => pattern.test(evidence))) {
    return {
      code: CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT,
      message: "Soroban simulation exceeded a resource limit or rejected its resource fee.",
      hint: [
        "Inspect error.cause for RPC simulation details and diagnostics. Reduce contract resource use,",
        "or use the simulation's required transaction data and fee when building a custom transaction.",
      ].join(" "),
    };
  }

  return undefined;
}

export function toSimulationError(
  error: unknown,
  contractName: string,
  method: string,
  rpcUrl: string,
  action: "prepare" | "simulate" = "simulate"
): CaatingaError {
  if (error instanceof CaatingaError && error.code !== CaatingaErrorCode.XDR_PREPARE_FAILED) {
    return error;
  }

  const failure = classifySimulationFailure(error);
  if (failure) {
    return new CaatingaError(
      `${failure.message} Call: "${contractName}.${method}".`,
      failure.code,
      `${failure.hint} RPC: ${rpcUrl}.`,
      error
    );
  }

  if (error instanceof CaatingaError) {
    return error;
  }

  return new CaatingaError(
    action === "prepare"
      ? `Failed to prepare XDR for "${contractName}.${method}".`
      : `Failed to simulate "${contractName}.${method}".`,
    CaatingaErrorCode.XDR_PREPARE_FAILED,
    `RPC: ${rpcUrl}. Check connectivity, simulation errors, and binding compatibility.`,
    error
  );
}

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
      throw toSimulationError(error, contractName, method, rpcUrl, "prepare");
    }
  }

  if (typeof candidate.simulate === "function") {
    try {
      return await candidate.simulate.call(transaction);
    } catch (error) {
      throw toSimulationError(error, contractName, method, rpcUrl);
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
