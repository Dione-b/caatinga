import { describe, expect, it } from "vitest";
import { isTransientCommandFailure } from "./is-transient-command-failure.js";

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
});
