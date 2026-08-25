import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "../shell/run-command.js";
import {
  evaluateStellarCliCompatibility,
  type CompatibilityReport,
  type CompatibilityWarning,
} from "./compat.js";
import { probeMissingStellarCliFeatures } from "./probe-stellar-cli-features.js";
import { parseStellarCliVersion } from "./version.js";

export type CheckStellarCliVersionOptions = {
  features?: readonly string[];
  lastTestedVersion?: string;
  onWarning?: (warning: CompatibilityWarning) => void;
  /** When false, skip live capability probes (used in unit tests). Default true. */
  probeFeatures?: boolean;
};

let cachedReport: CompatibilityReport | undefined;

/** @internal — exposed for tests that need to invalidate the module-level cache. */
export function _clearStellarCliVersionCache(): void {
  cachedReport = undefined;
}

export async function checkStellarCliVersion(
  input: CheckStellarCliVersionOptions = {}
): Promise<CompatibilityReport> {
  if (cachedReport) {
    for (const warning of cachedReport.warnings) {
      if (input.onWarning) {
        input.onWarning(warning);
      } else {
        defaultEmitWarning(warning);
      }
    }
    return cachedReport;
  }
  let rawOutput: string;

  try {
    const result = await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
    rawOutput = result.all || result.stdout || result.stderr;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      throw new CaatingaError(
        "Stellar CLI was not found.",
        CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
        "Install Stellar CLI before running Caatinga-backed commands.",
        error
      );
    }

    throw error;
  }

  const version = parseStellarCliVersion(rawOutput);
  const probedMissing =
    input.probeFeatures === false ? [] : await probeMissingStellarCliFeatures(version);
  const missingFeatures = [...(input.features ?? []), ...probedMissing];

  const report = evaluateStellarCliCompatibility({
    version,
    features: missingFeatures.length > 0 ? missingFeatures : undefined,
    lastTestedVersion: input.lastTestedVersion,
  });

  cachedReport = report;

  for (const warning of report.warnings) {
    if (input.onWarning) {
      input.onWarning(warning);
    } else {
      defaultEmitWarning(warning);
    }
  }

  return report;
}

function defaultEmitWarning(warning: CompatibilityWarning): void {
  const lines = [
    `Warning: ${warning.message}`,
    warning.remediation ? `  ${warning.remediation}` : undefined,
  ].filter((line): line is string => Boolean(line));

  process.stderr.write(`${lines.join("\n")}\n`);
}
