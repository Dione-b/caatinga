import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "../shell/run-command.js";
import {
  evaluateStellarCliCompatibility,
  type CompatibilityReport,
  type CompatibilityWarning
} from "./compat.js";
import { parseStellarCliVersion } from "./version.js";

export type CheckStellarCliVersionOptions = {
  features?: readonly string[];
  lastTestedVersion?: string;
  onWarning?: (warning: CompatibilityWarning) => void;
};

export async function checkStellarCliVersion(
  input: CheckStellarCliVersionOptions = {}
): Promise<CompatibilityReport> {
  let rawOutput: string;

  try {
    const result = await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true
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

  const report = evaluateStellarCliCompatibility({
    version: parseStellarCliVersion(rawOutput),
    features: input.features,
    lastTestedVersion: input.lastTestedVersion
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
    warning.remediation ? `  ${warning.remediation}` : undefined
  ].filter((line): line is string => Boolean(line));

  process.stderr.write(`${lines.join("\n")}\n`);
}
