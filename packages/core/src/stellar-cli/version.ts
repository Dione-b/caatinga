import semver from "semver";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

// 22.x fails to sign `stellar contract invoke` (xdr value invalid); 23.0.0+ is required.
export const STELLAR_CLI_MIN_VERSION = "23.0.0";

/**
 * Output signature of the signing failure that {@link STELLAR_CLI_MIN_VERSION} guards
 * against. The invoke hint and the deploy-recovery path both key off this one pattern so
 * they cannot disagree about which failures are the 22.x signing bug.
 */
export const STELLAR_CLI_SIGNING_FAILURE_REGEX = /xdr processing error: xdr value invalid/i;

const STELLAR_CLI_SEMVER_REGEX = /\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?)\b/;

export function parseStellarCliVersion(output: string): string {
  const match = output.match(STELLAR_CLI_SEMVER_REGEX);

  const version = match?.[1];

  if (!version || !semver.valid(version)) {
    throw new CaatingaError(
      "Could not parse Stellar CLI version from command output.",
      CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
      "Run `stellar --version` and verify that the output includes a semantic version."
    );
  }

  return version;
}
