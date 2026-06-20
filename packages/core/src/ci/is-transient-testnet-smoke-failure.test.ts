import { describe, expect, it } from "vitest";
import { isTransientTestnetSmokeFailure } from "./is-transient-testnet-smoke-failure.js";

describe("isTransientTestnetSmokeFailure", () => {
  it("should_return_true_when_log_contains_horizon_connection_timeout", () => {
    expect(isTransientTestnetSmokeFailure("timeout while connecting to horizon")).toBe(true);
  });

  it("should_return_true_when_log_contains_503_service_unavailable", () => {
    expect(isTransientTestnetSmokeFailure("503 Service Unavailable")).toBe(true);
  });

  it("should_return_true_when_log_contains_connection_reset", () => {
    expect(isTransientTestnetSmokeFailure("ECONNRESET")).toBe(true);
  });

  it("should_return_false_when_log_contains_unsupported_cli_code", () => {
    expect(
      isTransientTestnetSmokeFailure("Error CAATINGA_UNSUPPORTED_CLI_VERSION: bump stellar")
    ).toBe(false);
  });

  it("should_return_false_when_log_contains_version_parse_failure", () => {
    expect(isTransientTestnetSmokeFailure("CAATINGA_STELLAR_CLI_VERSION_PARSE_FAILED")).toBe(false);
  });

  it("should_return_false_when_log_contains_invalid_config", () => {
    expect(isTransientTestnetSmokeFailure("CAATINGA_INVALID_CONFIG")).toBe(false);
  });

  it("should_return_false_when_empty", () => {
    expect(isTransientTestnetSmokeFailure("")).toBe(false);
  });
});
