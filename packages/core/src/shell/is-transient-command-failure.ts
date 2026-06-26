const NO_RETRY_CAATINGA_SUBSTRINGS = [
  "CAATINGA_UNSUPPORTED_CLI_VERSION",
  "CAATINGA_STELLAR_CLI_VERSION_PARSE_FAILED",
  "CAATINGA_STELLAR_CLI_NOT_FOUND",
  "CAATINGA_INVALID_CONFIG",
  "CAATINGA_CONFIG_NOT_FOUND",
];

const TRANSIENT_COMMAND_FAILURE_PATTERN =
  /timeout|i\/o timeout|econnreset|connection reset|503|502|429|rate limit|temporar|bad gateway|fetch failed|network error|unavailable|tx_?bad_?seq|bad sequence|bad seq/i;

export function isTransientCommandFailure(logText: string): boolean {
  if (!logText.trim()) {
    return false;
  }
  for (const marker of NO_RETRY_CAATINGA_SUBSTRINGS) {
    if (logText.includes(marker)) {
      return false;
    }
  }
  return TRANSIENT_COMMAND_FAILURE_PATTERN.test(logText);
}
