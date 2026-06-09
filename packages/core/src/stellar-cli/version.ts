import semver from "semver";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

// 22.x fails to sign `stellar contract invoke` (xdr value invalid); 23.0.0+ is required.
export const STELLAR_CLI_MIN_VERSION = "23.0.0";

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
