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

let cachedReport: Promise<CompatibilityReport> | undefined;

/** Clears the per-process version-check cache. Intended for tests. */
export function resetStellarCliVersionCache(): void {
  cachedReport = undefined;
}

export async function checkStellarCliVersion(
  input: CheckStellarCliVersionOptions = {}
): Promise<CompatibilityReport> {
  // runCommand calls this with no arguments before every `stellar` subprocess,
  // so a single `ctg deploy` used to re-run the version parse plus three
  // `--help` probes ~10 times. Memoize exactly that plain call for the process
  // lifetime. Any call that passes explicit options (features, a custom
  // onWarning, probeFeatures, a lastTestedVersion override) is evaluated fresh,
  // so callers that need a real re-probe still get one.
  const isPlainRuntimeCheck =
    input.features === undefined &&
    input.lastTestedVersion === undefined &&
    input.onWarning === undefined &&
    input.probeFeatures === undefined;

  if (isPlainRuntimeCheck) {
    if (!cachedReport) {
      // Cache the in-flight promise so concurrent callers share one probe;
      // drop it on failure so a transient error does not poison the process.
      cachedReport = performStellarCliVersionCheck(input).catch((error) => {
        cachedReport = undefined;
        throw error;
      });
    }
    return cachedReport;
  }

  return performStellarCliVersionCheck(input);
}

async function performStellarCliVersionCheck(
  input: CheckStellarCliVersionOptions
): Promise<CompatibilityReport> {
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
