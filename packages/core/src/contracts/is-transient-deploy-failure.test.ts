import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isTransientDeployFailure } from "./is-transient-deploy-failure.js";

describe("isTransientDeployFailure", () => {
  it("should_return_true_when_deploy_failed_with_transaction_submission_timeout", () => {
    const error = new CaatingaError(
      "Command failed: stellar contract deploy",
      CaatingaErrorCode.DEPLOY_FAILED,
      "transaction submission timeout"
    );

    expect(isTransientDeployFailure(error)).toBe(true);
  });

  it("should_return_false_when_deploy_failed_with_simulation_error", () => {
    const error = new CaatingaError(
      "Command failed: stellar contract deploy",
      CaatingaErrorCode.DEPLOY_FAILED,
      "simulation failed: contract trap"
    );

    expect(isTransientDeployFailure(error)).toBe(false);
  });

  it("should_return_true_when_rpc_has_not_indexed_the_just_uploaded_wasm", () => {
    // Verbatim shape of the failure reported in #105: the upload succeeded, then the
    // instantiation step simulated against an RPC that had not indexed the hash yet.
    const error = new CaatingaError(
      "Command failed: stellar contract deploy --wasm ./target/app.wasm",
      CaatingaErrorCode.DEPLOY_FAILED,
      [
        "error: transaction simulation failed: HostError: Error(Storage, MissingValue)",
        "Event log (newest first):",
        '   0: [Diagnostic Event] topics:[error, Error(Storage, MissingValue)], data:["Wasm does not exist", Bytes(c191aaf8fe32345976438e7965194a39db34301176ee44a8bcea4399bb93c513)]',
      ].join("\n")
    );

    expect(isTransientDeployFailure(error)).toBe(true);
  });

  it("should_return_false_when_simulation_fails_with_a_missing_storage_entry_unrelated_to_wasm", () => {
    // MissingValue alone is not enough — only the wasm-specific diagnostic is a
    // propagation race. Otherwise real contract bugs would be retried.
    const error = new CaatingaError(
      "Command failed: stellar contract deploy",
      CaatingaErrorCode.DEPLOY_FAILED,
      "error: transaction simulation failed: HostError: Error(Storage, MissingValue)"
    );

    expect(isTransientDeployFailure(error)).toBe(false);
  });

  it("should_return_false_for_non_deploy_errors", () => {
    const error = new CaatingaError("Invalid config", CaatingaErrorCode.INVALID_CONFIG, "timeout");

    expect(isTransientDeployFailure(error)).toBe(false);
  });
});
