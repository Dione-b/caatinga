import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  NO_RETRY_ERROR_CODES,
  isTransientCaatingaFailure,
  isTransientCommandFailure,
} from "./is-transient-command-failure.js";

describe("isTransientCommandFailure", () => {
  it("should_return_true_when_log_contains_horizon_connection_timeout", () => {
    expect(isTransientCommandFailure("timeout while connecting to horizon")).toBe(true);
  });

  it("should_return_true_when_log_contains_503_service_unavailable", () => {
    expect(isTransientCommandFailure("503 Service Unavailable")).toBe(true);
  });

  it("should_return_true_when_log_contains_connection_reset", () => {
    expect(isTransientCommandFailure("ECONNRESET")).toBe(true);
  });

  it("should_return_true_when_log_contains_stellar_bad_sequence", () => {
    expect(isTransientCommandFailure("transaction failed: TxBadSeq")).toBe(true);
    expect(isTransientCommandFailure("tx_bad_seq")).toBe(true);
    expect(isTransientCommandFailure("bad sequence number")).toBe(true);
  });

  it("should_return_false_when_log_contains_unsupported_cli_code", () => {
    expect(isTransientCommandFailure("Error CAATINGA_UNSUPPORTED_CLI_VERSION: bump stellar")).toBe(
      false
    );
  });

  it("should_return_false_when_log_contains_version_parse_failure", () => {
    expect(isTransientCommandFailure("CAATINGA_STELLAR_CLI_VERSION_PARSE_FAILED")).toBe(false);
  });

  it("should_return_false_when_log_contains_invalid_config", () => {
    expect(isTransientCommandFailure("CAATINGA_INVALID_CONFIG")).toBe(false);
  });

  it("should_return_false_when_empty", () => {
    expect(isTransientCommandFailure("")).toBe(false);
  });

  it("should_return_false_when_captured_cli_output_reports_a_no_retry_code", () => {
    // The CLI prints `  Code: <code>` under the message (see cli/src/utils/errors.ts),
    // which is the input shape the CI smoke path feeds in.
    const capturedCliOutput = [
      "✖ Error",
      "Command failed: stellar contract invoke (connection reset by peer)",
      `  Code: ${CaatingaErrorCode.INVALID_CONFIG}`,
    ].join("\n");

    expect(isTransientCommandFailure(capturedCliOutput)).toBe(false);
  });
});

describe("isTransientCaatingaFailure", () => {
  const transientMessage = "Command failed: stellar contract invoke (connection reset)";

  it("should_return_true_when_retryable_code_has_a_transient_message", () => {
    const error = new CaatingaError(transientMessage, CaatingaErrorCode.INVOKE_FAILED);

    expect(isTransientCaatingaFailure(error, CaatingaErrorCode.INVOKE_FAILED)).toBe(true);
  });

  it("should_detect_transient_signals_in_the_hint_as_well_as_the_message", () => {
    const error = new CaatingaError(
      "Command failed",
      CaatingaErrorCode.DEPLOY_FAILED,
      "503 from RPC"
    );

    expect(isTransientCaatingaFailure(error, CaatingaErrorCode.DEPLOY_FAILED)).toBe(true);
  });

  it("should_return_false_when_code_does_not_match_the_retryable_code", () => {
    const error = new CaatingaError(transientMessage, CaatingaErrorCode.DEPLOY_FAILED);

    expect(isTransientCaatingaFailure(error, CaatingaErrorCode.INVOKE_FAILED)).toBe(false);
  });

  it.each([...NO_RETRY_ERROR_CODES])(
    "should_never_retry_%s_even_with_a_transient_message",
    (code) => {
      // Codes live on `error.code`, not in the text — checking the code is what makes
      // the no-retry list actually enforceable.
      const error = new CaatingaError(transientMessage, code);

      expect(isTransientCaatingaFailure(error, code)).toBe(false);
    }
  );

  it("should_return_false_for_a_plain_error", () => {
    expect(
      isTransientCaatingaFailure(new Error(transientMessage), CaatingaErrorCode.INVOKE_FAILED)
    ).toBe(false);
  });

  it("should_return_false_for_non_error_values", () => {
    expect(isTransientCaatingaFailure(undefined, CaatingaErrorCode.INVOKE_FAILED)).toBe(false);
    expect(isTransientCaatingaFailure(transientMessage, CaatingaErrorCode.INVOKE_FAILED)).toBe(
      false
    );
  });

  it("should_return_false_when_the_failure_is_not_transient", () => {
    const error = new CaatingaError("contract method not found", CaatingaErrorCode.INVOKE_FAILED);

    expect(isTransientCaatingaFailure(error, CaatingaErrorCode.INVOKE_FAILED)).toBe(false);
  });
});
