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

type ValidationContext = {
  cwd: string;
  features?: readonly string[];
  lastTestedVersion?: string;
};

const validationCache = new Map<string, Promise<CompatibilityReport>>();

export async function checkStellarCliVersion(
  input: CheckStellarCliVersionOptions = {}
): Promise<CompatibilityReport> {
  const context: ValidationContext = {
    cwd: process.cwd(),
    features: input.features,
    lastTestedVersion: input.lastTestedVersion,
  };
  const cacheKey = JSON.stringify({
    cwd: context.cwd,
    features: context.features ?? [],
    lastTestedVersion: context.lastTestedVersion,
    probeFeatures: input.probeFeatures !== false,
  });

  let validation = validationCache.get(cacheKey);
  if (!validation) {
    validation = validateStellarCli(context, input.probeFeatures !== false);
    validationCache.set(cacheKey, validation);
    validation.catch(() => {
      if (validationCache.get(cacheKey) === validation) {
        validationCache.delete(cacheKey);
      }
    });
  }

  const report = await validation;
  for (const warning of report.warnings) {
    if (input.onWarning) {
      input.onWarning(warning);
    } else {
      defaultEmitWarning(warning);
    }
  }
  return report;
}

async function validateStellarCli(
  input: ValidationContext,
  probeFeatures: boolean
): Promise<CompatibilityReport> {
  let rawOutput: string;

  try {
    const result = await runCommand("stellar", ["--version"], {
      cwd: input.cwd,
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
  const probedMissing = probeFeatures
    ? await probeMissingStellarCliFeatures(version, input.cwd)
    : [];
  const missingFeatures = [...(input.features ?? []), ...probedMissing];

  return evaluateStellarCliCompatibility({
    version,
    features: missingFeatures.length > 0 ? missingFeatures : undefined,
    lastTestedVersion: input.lastTestedVersion,
  });
}

function defaultEmitWarning(warning: CompatibilityWarning): void {
  const lines = [
    `Warning: ${warning.message}`,
    warning.remediation ? `  ${warning.remediation}` : undefined,
  ].filter((line): line is string => Boolean(line));

  process.stderr.write(`${lines.join("\n")}\n`);
}
