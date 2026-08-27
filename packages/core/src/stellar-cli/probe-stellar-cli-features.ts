import semver from "semver";
import { runCommand } from "../shell/run-command.js";
import { STELLAR_CLI_MIN_VERSION } from "./version.js";

export const STELLAR_CLI_REQUIRED_FEATURES = [
  "contract-build",
  "contract-deploy",
  "contract-invoke-sign",
] as const;

export type StellarCliRequiredFeature = (typeof STELLAR_CLI_REQUIRED_FEATURES)[number];

const FEATURE_COMMANDS: Record<StellarCliRequiredFeature, string[]> = {
  "contract-build": ["contract", "build", "--help"],
  "contract-deploy": ["contract", "deploy", "--help"],
  "contract-invoke-sign": ["contract", "invoke", "--help"],
};

const cachedMissingByVersion = new Map<string, string[]>();

/**
 * Probes the installed Stellar CLI for subcommands Caatinga depends on.
 * Returns feature ids that are missing or unreachable.
 */
export async function probeMissingStellarCliFeatures(version: string): Promise<string[]> {
  const cached = cachedMissingByVersion.get(version);
  if (cached) {
    return cached;
  }

  const missing: string[] = [];

  if (semver.valid(version) && semver.lt(version, STELLAR_CLI_MIN_VERSION)) {
    const result = ["contract-invoke-sign"];
    cachedMissingByVersion.set(version, result);
    return result;
  }

  for (const feature of STELLAR_CLI_REQUIRED_FEATURES) {
    try {
      await runCommand("stellar", FEATURE_COMMANDS[feature], {
        skipStellarVersionCheck: true,
      });
    } catch {
      missing.push(feature);
    }
  }

  cachedMissingByVersion.set(version, missing);
  return missing;
}
