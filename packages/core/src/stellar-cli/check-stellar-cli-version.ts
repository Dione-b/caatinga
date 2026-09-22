import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { emitWarningToStderr } from "../shell/emit-warning-to-stderr.js";
import { runCommand } from "../shell/run-command.js";
import {
  evaluateStellarCliCompatibility,
  type CompatibilityReport,
  type CompatibilityWarning,
} from "./compat.js";
import { probeMissingStellarCliFeatures } from "./probe-stellar-cli-features.js";
import { parseStellarCliVersion } from "./version.js";
import { VERSION_PROBE_TIMEOUT_MS } from "../shell/command-timeouts.js";

export type CheckStellarCliVersionOptions = {
  features?: readonly string[];
  lastTestedVersion?: string;
  onWarning?: (warning: CompatibilityWarning) => void;
  /** When false, skip live capability probes (used in unit tests). Default true. */
  probeFeatures?: boolean;
};

let cachedVersionByCwd = new Map<string, Promise<string>>();

/** @internal — exposed for tests that need to invalidate the module-level cache. */
export function _clearStellarCliVersionCache(): void {
  cachedVersionByCwd = new Map();
}

export async function checkStellarCliVersion(
  input: CheckStellarCliVersionOptions = {}
): Promise<CompatibilityReport> {
  const cwd = process.cwd();

  let versionPromise = cachedVersionByCwd.get(cwd);
  if (!versionPromise) {
    versionPromise = resolveStellarCliVersion(cwd);
    cachedVersionByCwd.set(cwd, versionPromise);
    versionPromise.catch(() => {
      if (cachedVersionByCwd.get(cwd) === versionPromise) {
        cachedVersionByCwd.delete(cwd);
      }
    });
  }

  const version = await versionPromise;
  const probedMissing =
    input.probeFeatures === false ? [] : await probeMissingStellarCliFeatures(version, cwd);
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

async function resolveStellarCliVersion(cwd: string): Promise<string> {
  let rawOutput: string;

  try {
    const result = await runCommand("stellar", ["--version"], {
      cwd,
      skipStellarVersionCheck: true,
      timeout: VERSION_PROBE_TIMEOUT_MS,
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

  return parseStellarCliVersion(rawOutput);
}

function defaultEmitWarning(_warning: CompatibilityWarning): void {
  // Intentionally a no-op: library consumers and browser builds should not
  // receive unsolicited stderr output. Supply an `onWarning` callback to
  // handle warnings explicitly.
}

/**
 * Writes a compatibility warning to stderr. Not used as the default —
 * internal callers that run on a real terminal (e.g. `runCommand`) opt into
 * this explicitly via `onWarning` so warnings stay visible there without
 * forcing stderr output on every consumer of `checkStellarCliVersion`.
 */
export function emitStellarCliWarningToStderr(warning: CompatibilityWarning): void {
  emitWarningToStderr(warning);
}
