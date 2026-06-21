import { describe, expect, it, beforeAll } from "vitest";
import { checkBinary } from "../shell/check-binary.js";
import { checkStellarCliVersion } from "./check-stellar-cli-version.js";
import {
  probeMissingStellarCliFeatures,
  STELLAR_CLI_REQUIRED_FEATURES,
} from "./probe-stellar-cli-features.js";
import { parseStellarCliVersion } from "./version.js";

describe("probeMissingStellarCliFeatures (live Stellar CLI)", () => {
  let stellarAvailable = false;

  beforeAll(async () => {
    try {
      await checkBinary("stellar", "missing");
      stellarAvailable = true;
    } catch {
      stellarAvailable = false;
    }
  });

  it("should_report_no_missing_features_for_installed_cli", async () => {
    if (!stellarAvailable) {
      return;
    }

    const result = await checkStellarCliVersion({ probeFeatures: true });
    const missing = await probeMissingStellarCliFeatures(result.version);

    expect(STELLAR_CLI_REQUIRED_FEATURES.every((feature) => !missing.includes(feature))).toBe(true);
    expect(result.warnings.filter((w) => w.code === "STELLAR_CLI_MISSING_FEATURE")).toEqual([]);
  });

  it("should_parse_version_from_stellar_binary", async () => {
    if (!stellarAvailable) {
      return;
    }

    const report = await checkStellarCliVersion({ probeFeatures: false });
    expect(report.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(parseStellarCliVersion(`stellar ${report.version}`)).toBe(report.version);
  });
});
