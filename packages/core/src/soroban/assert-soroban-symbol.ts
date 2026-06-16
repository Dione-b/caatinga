import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const SOROBAN_SYMBOL_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

export function assertSorobanSymbol(value: string, paramName = "symbol"): void {
  if (SOROBAN_SYMBOL_PATTERN.test(value)) {
    return;
  }

  throw new CaatingaError(
    `Invalid Soroban Symbol for "${paramName}".`,
    CaatingaErrorCode.INVOKE_FAILED,
    [
      "Soroban Symbol values may only contain ASCII letters, digits, and underscores (max 32 chars).",
      `Received: ${JSON.stringify(value)}`,
      "See docs/soroban-types.md for examples."
    ].join("\n")
  );
}
