import semver from "semver";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { STELLAR_CLI_MIN_VERSION } from "./version.js";

export { STELLAR_CLI_MIN_VERSION, parseStellarCliVersion } from "./version.js";

export const STELLAR_CLI_LAST_TESTED_VERSION = "27.0.0";

export type CompatibilityStatus = "supported" | "untested" | "unsupported";

export type CompatibilityWarningCode =
  | "STELLAR_CLI_UNTESTED_VERSION"
  | "STELLAR_CLI_MISSING_FEATURE";

export type CompatibilityWarning = {
  code: CompatibilityWarningCode;
  message: string;
  remediation?: string;
};

export type CompatibilityReport = {
  version: string;
  status: CompatibilityStatus;
  minVersion: string;
  lastTestedVersion: string;
  warnings: CompatibilityWarning[];
};

export type EvaluateStellarCliCompatibilityInput = {
  version: string;
  features?: readonly string[];
  lastTestedVersion?: string;
};

export function evaluateStellarCliCompatibility(
  input: EvaluateStellarCliCompatibilityInput
): CompatibilityReport {
  const parsed = semver.parse(input.version);

  if (!parsed || !semver.valid(input.version)) {
    throw new CaatingaError(
      "Could not parse Stellar CLI version.",
      CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
      "Use a semantic version such as 22.0.1."
    );
  }

  const lastTestedVersion =
    semver.valid(input.lastTestedVersion ?? STELLAR_CLI_LAST_TESTED_VERSION) ??
    STELLAR_CLI_LAST_TESTED_VERSION;

  const warnings: CompatibilityWarning[] = [];
  let status: CompatibilityStatus = "supported";

  if (semver.lt(parsed, STELLAR_CLI_MIN_VERSION)) {
    throw new CaatingaError(
      `Stellar CLI ${input.version} is below the supported minimum ${STELLAR_CLI_MIN_VERSION}.`,
      CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
      `Install Stellar CLI ${STELLAR_CLI_MIN_VERSION} or newer.`
    );
  }

  if (semver.gt(parsed, lastTestedVersion)) {
    status = "untested";
    warnings.push({
      code: "STELLAR_CLI_UNTESTED_VERSION",
      message: `Stellar CLI ${input.version} is newer than the last-tested ${lastTestedVersion}; proceeding without compatibility guarantees.`,
      remediation:
        "Pin Stellar CLI to the last-tested version, or update Caatinga after re-running the parser fixtures.",
    });
  }

  if (input.features) {
    for (const feature of input.features) {
      if (!feature) {
        continue;
      }
      status = "untested";
      warnings.push({
        code: "STELLAR_CLI_MISSING_FEATURE",
        message: `Stellar CLI ${input.version} did not advertise the required feature "${feature}".`,
        remediation: "Upgrade Stellar CLI or run `ctg doctor` for diagnostics.",
      });
    }
  }

  return {
    version: input.version,
    status,
    minVersion: STELLAR_CLI_MIN_VERSION,
    lastTestedVersion,
    warnings,
  };
}
