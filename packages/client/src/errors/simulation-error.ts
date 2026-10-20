import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";

type SimulationFailure = {
  code:
    | typeof CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND
    | typeof CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT
    | typeof CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED;
  message: string;
  hint: string;
};

// Patterns are anchored to strings Soroban RPC, stellar-core result codes and
// stellar-sdk's AssembledTransaction actually emit, so generic text such as
// "429: rate limit exceeded" or a field named `restorePreamble` does not match.
const ARCHIVED_ENTRY_PATTERNS = [
  /ENTRY_ARCHIVED/,
  // stellar-sdk ExpiredStateError, raised by the `result` getter and by `signAndSend`.
  /YOU NEED TO RESTORE SOME CONTRACT STATE/,
];
const MISSING_ACCOUNT_PATTERNS = [
  // stellar-sdk `Server.getAccount`: "Account not found: G...".
  /ACCOUNT NOT FOUND/,
  /ACCOUNT_NOT_FOUND/,
  // stellar-core `txNO_ACCOUNT` / `opNO_ACCOUNT`, upper-cased.
  /\b(?:TX|OP)_?NO_ACCOUNT\b/,
];
const RESOURCE_LIMIT_PATTERNS = [
  // e.g. INVOKE_HOST_FUNCTION_RESOURCE_LIMIT_EXCEEDED.
  /RESOURCE_LIMIT_EXCEEDED/,
  // Simulation `HostError: Error(Budget, ExceededLimit)`.
  /ERROR\(BUDGET,\s*EXCEEDEDLIMIT\)/,
  // stellar-core `txINSUFFICIENT_FEE`, upper-cased.
  /\bTX_?INSUFFICIENT_FEE\b/,
  /INSUFFICIENT_REFUNDABLE_FEE/,
];

const TEXT_FIELDS = [
  "name",
  "code",
  "message",
  "error",
  "details",
  "detail",
  "data",
  "response",
  "result",
  "cause",
  "simulation",
];

/** Field values (never field names) from an error and the objects it wraps. */
function collectErrorText(value: unknown, seen = new Set<object>(), depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }

  if (typeof value !== "object" || seen.has(value)) {
    return [];
  }

  seen.add(value);

  return TEXT_FIELDS.flatMap((field) => {
    let fieldValue: unknown;
    try {
      fieldValue = (value as Record<string, unknown>)[field];
    } catch {
      // Getters such as AssembledTransaction.result can throw; skip them here.
      return [];
    }
    return collectErrorText(fieldValue, seen, depth + 1);
  });
}

/** True when the error or a wrapped simulation carries a non-null `restorePreamble`. */
function hasRestorePreamble(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (depth > 4 || value === null || typeof value !== "object" || seen.has(value)) {
    return false;
  }

  seen.add(value);
  const record = value as Record<string, unknown>;

  if ("restorePreamble" in record && record.restorePreamble != null) {
    return true;
  }

  return ["cause", "simulation", "response", "data", "error"].some((field) => {
    try {
      return hasRestorePreamble(record[field], seen, depth + 1);
    } catch {
      return false;
    }
  });
}

function classifySimulationFailure(error: unknown): SimulationFailure | undefined {
  const evidence = collectErrorText(error).join(" ").toUpperCase();

  if (
    hasRestorePreamble(error) ||
    ARCHIVED_ENTRY_PATTERNS.some((pattern) => pattern.test(evidence))
  ) {
    return {
      code: CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED,
      message: "Simulation requires restoration of archived Soroban contract state.",
      hint: [
        "For a write, retry with invoke(method, args, { restore: true }) and a compatible binding;",
        "the wallet is asked to approve a RestoreFootprint transaction first.",
        "For a read, restore the state with a separate RestoreFootprint transaction, then retry.",
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

/**
 * Classified simulation error for a known Soroban failure, or `undefined` so the caller
 * keeps its own error code. Caatinga errors other than `XDR_PREPARE_FAILED` are never
 * reclassified.
 */
export function classifySimulationError(
  error: unknown,
  contractName: string,
  method: string,
  rpcUrl: string
): CaatingaError | undefined {
  if (error instanceof CaatingaError && error.code !== CaatingaErrorCode.XDR_PREPARE_FAILED) {
    return undefined;
  }

  const failure = classifySimulationFailure(error);
  if (!failure) {
    return undefined;
  }

  return new CaatingaError(
    `${failure.message} Call: "${contractName}.${method}".`,
    failure.code,
    `${failure.hint} RPC: ${rpcUrl}.`,
    error
  );
}

/** `classifySimulationError`, falling back to `XDR_PREPARE_FAILED` for unknown errors. */
export function toSimulationError(
  error: unknown,
  contractName: string,
  method: string,
  rpcUrl: string,
  action: "prepare" | "simulate" = "simulate"
): CaatingaError {
  const classified = classifySimulationError(error, contractName, method, rpcUrl);
  if (classified) {
    return classified;
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
