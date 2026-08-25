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

export async function checkStellarCliVersion(
  input: CheckStellarCliVersionOptions = {}
): Promise<CompatibilityReport> {
  let rawOutput: string;

  try {
    const result = await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
    rawOutput = result.all || result.stdout || result.stderr;
  } catch (error) {
    // #95: `runCommand` already converts a spawn ENOENT into
    // CaatingaError(STELLAR_CLI_NOT_FOUND), so the thrown error's code is
    // "CAATINGA_STELLAR_CLI_NOT_FOUND", never "ENOENT" — the old guard here was
    // dead. Just re-throw the already-wrapped error.
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
