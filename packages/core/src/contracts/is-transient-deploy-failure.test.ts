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

  it("should_return_false_for_non_deploy_errors", () => {
    const error = new CaatingaError("Invalid config", CaatingaErrorCode.INVALID_CONFIG, "timeout");

    expect(isTransientDeployFailure(error)).toBe(false);
  });
});
