import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

// The Soroban host (`Symbol::try_from`) requires the first character to be an
// ASCII letter or underscore — a leading digit is rejected at simulation/invoke
// time. Mirror that rule here so the error is caught early (#92).
const SOROBAN_SYMBOL_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

export function assertSorobanSymbol(value: string, paramName = "symbol"): void {
  if (SOROBAN_SYMBOL_PATTERN.test(value)) {
    return;
  }

  throw new CaatingaError(
    `Invalid Soroban Symbol for "${paramName}".`,
    CaatingaErrorCode.INVOKE_FAILED,
    [
      "Soroban Symbol values may only contain ASCII letters, digits, and underscores (max 32 chars), and must start with a letter or underscore.",
      `Received: ${JSON.stringify(value)}`,
      "See docs/soroban-types.md for examples.",
    ].join("\n")
  );
}
