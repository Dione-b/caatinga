import { beforeEach, describe, expect, it, beforeAll, vi } from "vitest";
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

// Caching tests use fresh module state via vi.resetModules().
const probeRunCommandMock = vi.hoisted(() => vi.fn());

describe("probeMissingStellarCliFeatures caching", () => {
  beforeEach(() => {
    vi.resetModules();
    probeRunCommandMock.mockReset();
  });

  it("caches feature probe results for a given version", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: probeRunCommandMock,
    }));

    const { probeMissingStellarCliFeatures } = await import("./probe-stellar-cli-features.js");

    // All three features available.
    probeRunCommandMock.mockResolvedValue({ stdout: "", stderr: "", all: "" });

    const missing1 = await probeMissingStellarCliFeatures("25.2.0");
    const missing2 = await probeMissingStellarCliFeatures("25.2.0");

    expect(missing1).toEqual([]);
    expect(missing2).toBe(missing1);
    // Only 3 calls (one per feature), not 6.
    expect(probeRunCommandMock).toHaveBeenCalledTimes(3);
  });

  it("does not share cached results between different versions", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: probeRunCommandMock,
    }));

    const { probeMissingStellarCliFeatures } = await import("./probe-stellar-cli-features.js");

    probeRunCommandMock.mockResolvedValue({ stdout: "", stderr: "", all: "" });

    const missing1 = await probeMissingStellarCliFeatures("25.2.0");
    const missing2 = await probeMissingStellarCliFeatures("26.0.0");

    expect(missing1).toEqual([]);
    expect(missing2).toEqual([]);
    // 3 calls for 25.2.0, 3 calls for 26.0.0.
    expect(probeRunCommandMock).toHaveBeenCalledTimes(6);
  });

  it("caches below-minimum version result without probing", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: probeRunCommandMock,
    }));

    const { probeMissingStellarCliFeatures } = await import("./probe-stellar-cli-features.js");

    const missing1 = await probeMissingStellarCliFeatures("22.0.1");
    const missing2 = await probeMissingStellarCliFeatures("22.0.1");

    expect(missing1).toEqual(["contract-invoke-sign"]);
    expect(missing2).toBe(missing1);
    // No subprocess calls at all for below-minimum versions.
    expect(probeRunCommandMock).not.toHaveBeenCalled();
  });
});
