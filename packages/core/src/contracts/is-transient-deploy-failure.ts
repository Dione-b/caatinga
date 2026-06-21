import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isTransientCommandFailure } from "../shell/is-transient-command-failure.js";

export function isTransientDeployFailure(error: unknown): boolean {
  if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.DEPLOY_FAILED) {
    return false;
  }

  const logText = `${error.message}\n${error.hint ?? ""}`;
  return isTransientCommandFailure(logText);
}
