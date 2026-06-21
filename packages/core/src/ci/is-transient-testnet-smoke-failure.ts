import { isTransientCommandFailure } from "../shell/is-transient-command-failure.js";

export function isTransientTestnetSmokeFailure(logText: string): boolean {
  return isTransientCommandFailure(logText);
}
