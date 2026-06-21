import semver from "semver";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { STELLAR_SDK_LAST_TESTED_VERSION, STELLAR_SDK_MIN_VERSION } from "./version.js";

export { STELLAR_SDK_LAST_TESTED_VERSION, STELLAR_SDK_MIN_VERSION } from "./version.js";

export type SdkCompatibilityStatus = "supported" | "untested" | "unsupported";

export type SdkCompatibilityWarningCode =
  | "STELLAR_SDK_UNTESTED_VERSION"
  | "STELLAR_SDK_VERSION_PARSE_FAILED";

export type SdkCompatibilityWarning = {
  code: SdkCompatibilityWarningCode;
  message: string;
  remediation?: string;
};

export type SdkCompatibilityReport = {
  version: string;
  status: SdkCompatibilityStatus;
  minVersion: string;
  lastTestedVersion: string;
  warnings: SdkCompatibilityWarning[];
};

export type EvaluateStellarSdkCompatibilityInput = {
  version: string;
  lastTestedVersion?: string;
};

export function evaluateStellarSdkCompatibility(
  input: EvaluateStellarSdkCompatibilityInput
): SdkCompatibilityReport {
  const parsed = semver.parse(input.version);

  if (!parsed || !semver.valid(input.version)) {
    throw new CaatingaError(
      "Could not parse @stellar/stellar-sdk version.",
      CaatingaErrorCode.STELLAR_SDK_VERSION_PARSE_FAILED,
      "Use a semantic version such as 16.0.1."
    );
  }

  const lastTestedVersion =
    semver.valid(input.lastTestedVersion ?? STELLAR_SDK_LAST_TESTED_VERSION) ??
    STELLAR_SDK_LAST_TESTED_VERSION;

  const warnings: SdkCompatibilityWarning[] = [];
  let status: SdkCompatibilityStatus = "supported";

  if (semver.lt(parsed, STELLAR_SDK_MIN_VERSION)) {
    throw new CaatingaError(
      `@stellar/stellar-sdk ${input.version} is below the supported minimum ${STELLAR_SDK_MIN_VERSION}.`,
      CaatingaErrorCode.UNSUPPORTED_SDK_VERSION,
      `Install @stellar/stellar-sdk ${STELLAR_SDK_MIN_VERSION} or newer.`
    );
  }

  if (semver.gt(parsed, lastTestedVersion)) {
    status = "untested";
    warnings.push({
      code: "STELLAR_SDK_UNTESTED_VERSION",
      message: `@stellar/stellar-sdk ${input.version} is newer than the last-tested ${lastTestedVersion}; binding output may differ.`,
      remediation:
        "Pin @stellar/stellar-sdk to the last-tested version in package.json, or update Caatinga fixtures after validating generate output.",
    });
  }

  return {
    version: input.version,
    status,
    minVersion: STELLAR_SDK_MIN_VERSION,
    lastTestedVersion,
    warnings,
  };
}

export function parseStellarSdkVersion(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/);
  if (!match) {
    throw new CaatingaError(
      "Could not parse @stellar/stellar-sdk version.",
      CaatingaErrorCode.STELLAR_SDK_VERSION_PARSE_FAILED,
      "Expected output like 16.0.1."
    );
  }

  return match[1]!;
}
