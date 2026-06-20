import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { READ_CALL_FAILURE_REGEX } from "./read-call-pattern.js";

export function enrichReadCallInvokeError(
  error: unknown,
  contractName: string,
  method: string
): CaatingaError | null {
  const message = error instanceof Error ? error.message : String(error);
  const hint = error instanceof CaatingaError ? (error.hint ?? "") : "";
  const haystack = `${message}\n${hint}`;

  if (!READ_CALL_FAILURE_REGEX.test(haystack)) {
    return null;
  }

  return new CaatingaError(
    `Failed to submit XDR for "${contractName}.${method}".`,
    CaatingaErrorCode.XDR_SUBMIT_FAILED,
    [
      `"${contractName}.${method}" is a read-only contract method.`,
      "Use read() or simulate() instead of invoke():",
      `  client.contract("${contractName}").read("${method}")`,
      `  client.contract("${contractName}").simulate("${method}")`,
      "Pass method args as the second argument to read() when the contract method takes parameters.",
    ].join("\n"),
    error
  );
}
