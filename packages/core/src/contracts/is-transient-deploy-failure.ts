import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isTransientCaatingaFailure } from "../shell/is-transient-command-failure.js";

/**
 * `stellar contract deploy` uploads the WASM and then instantiates it within one command.
 * The RPC's simulation endpoint may not have indexed the just-uploaded hash yet, so the
 * instantiation step fails with `Error(Storage, MissingValue)` and the diagnostic
 * `"Wasm does not exist"` for a hash that *is* on-chain. Retrying resolves it.
 *
 * Deliberately narrow: it matches the wasm-specific diagnostic rather than `MissingValue`
 * or "simulation failed" broadly, so a genuine simulation error (contract trap, missing
 * storage entry) stays non-retryable.
 */
import { WASM_NOT_YET_INDEXED_PATTERN } from "./wasm-indexing-pattern.js";

export function isTransientDeployFailure(error: unknown): boolean {
  if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.DEPLOY_FAILED) {
    return false;
  }

  if (WASM_NOT_YET_INDEXED_PATTERN.test(`${error.message}\n${error.hint ?? ""}`)) {
    return true;
  }

  return isTransientCaatingaFailure(error, CaatingaErrorCode.DEPLOY_FAILED);
}
