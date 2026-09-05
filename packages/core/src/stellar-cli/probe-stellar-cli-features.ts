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

const featureProbeCache = new Map<string, Promise<string[]>>();

/**
 * Probes the installed Stellar CLI for subcommands Caatinga depends on.
 * Returns feature ids that are missing or unreachable.
 */
export async function probeMissingStellarCliFeatures(
  version: string,
  cwd = process.cwd()
): Promise<string[]> {
  const cacheKey = `${cwd}\u0000${version}`;
  const cached = featureProbeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const probe = probeFeatures(version, cwd);
  featureProbeCache.set(cacheKey, probe);
  probe.catch(() => {
    if (featureProbeCache.get(cacheKey) === probe) {
      featureProbeCache.delete(cacheKey);
    }
  });
  return probe;
}

async function probeFeatures(version: string, cwd: string): Promise<string[]> {
  const missing: string[] = [];

  if (semver.valid(version) && semver.lt(version, STELLAR_CLI_MIN_VERSION)) {
    return ["contract-invoke-sign"];
  }

  for (const feature of STELLAR_CLI_REQUIRED_FEATURES) {
    try {
      await runCommand("stellar", FEATURE_COMMANDS[feature], {
        cwd,
        skipStellarVersionCheck: true,
      });
    } catch {
      missing.push(feature);
    }
  }

  return missing;
}
