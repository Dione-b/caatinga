import { CaatingaError } from "../errors/CaatingaError.js";
import { CaatingaErrorCode, type CaatingaErrorCodeValue } from "../errors/CaatingaErrorCode.js";

/**
 * Failures that are never worth retrying, no matter what the message says.
 *
 * Typed against CaatingaErrorCode so an entry cannot drift into a code that no
 * longer exists — the previous plain-string list had no such guarantee.
 */
export const NO_RETRY_ERROR_CODES: ReadonlySet<CaatingaErrorCodeValue> = new Set([
  CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
  CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
  CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
  CaatingaErrorCode.INVALID_CONFIG,
  CaatingaErrorCode.CONFIG_NOT_FOUND,
]);

const TRANSIENT_COMMAND_FAILURE_PATTERN =
  /timeout|i\/o timeout|econnreset|connection reset|\b503\b|\b502\b|\b429\b|rate limit|temporar|bad gateway|fetch failed|network error|unavailable|tx_?bad_?seq|bad sequence|bad seq/i;

/**
 * Decides retryability from raw log text — captured CLI output, as passed by the
 * CI smoke path. The CLI prints `Code: CAATINGA_…` alongside the message, so the
 * code scan below does match on this input.
 *
 * When a CaatingaError object is available, prefer {@link isTransientCaatingaFailure},
 * which reads `error.code` directly instead of hoping it appears in the text.
 */
export function isTransientCommandFailure(logText: string): boolean {
  if (!logText.trim()) {
    return false;
  }

  for (const code of NO_RETRY_ERROR_CODES) {
    if (logText.includes(code)) {
      return false;
    }
  }

  return TRANSIENT_COMMAND_FAILURE_PATTERN.test(logText);
}

/**
 * Decides retryability from a thrown error, enforcing the no-retry list against
 * `error.code` — the authoritative field. `retryableCode` is the single failure
 * kind the caller is prepared to retry.
 */
export function isTransientCaatingaFailure(
  error: unknown,
  retryableCode: CaatingaErrorCodeValue
): boolean {
  if (!(error instanceof CaatingaError) || error.code !== retryableCode) {
    return false;
  }

  if (NO_RETRY_ERROR_CODES.has(error.code)) {
    return false;
  }

  return isTransientCommandFailure(`${error.message}\n${error.hint ?? ""}`);
}
