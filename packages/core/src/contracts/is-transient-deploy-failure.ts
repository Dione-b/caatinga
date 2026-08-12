import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isTransientCaatingaFailure } from "../shell/is-transient-command-failure.js";

export function isTransientDeployFailure(error: unknown): boolean {
  return isTransientCaatingaFailure(error, CaatingaErrorCode.DEPLOY_FAILED);
}
