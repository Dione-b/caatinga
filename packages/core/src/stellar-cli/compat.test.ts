import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { parseStellarCliVersion } from "./version.js";
import {
  STELLAR_CLI_LAST_TESTED_VERSION,
  STELLAR_CLI_MIN_VERSION,
  evaluateStellarCliCompatibility,
} from "./compat.js";

describe("evaluateStellarCliCompatibility", () => {
  it("declares the hard floor and the advisory last-tested version", () => {
    expect(STELLAR_CLI_MIN_VERSION).toBe("23.0.0");
    expect(STELLAR_CLI_LAST_TESTED_VERSION).toBe("25.2.0");
  });

  it("returns supported with no warnings for the last-tested version", () => {
    const report = evaluateStellarCliCompatibility({ version: "25.2.0" });

    expect(report).toEqual({
      version: "25.2.0",
      status: "supported",
      minVersion: "23.0.0",
      lastTestedVersion: "25.2.0",
      warnings: [],
    });
  });

  it("returns supported for the minimum version", () => {
    const report = evaluateStellarCliCompatibility({ version: "23.0.0" });

    expect(report.status).toBe("supported");
    expect(report.warnings).toEqual([]);
  });

  it("returns untested with a warning for a version above the last-tested", () => {
    const report = evaluateStellarCliCompatibility({ version: "26.0.0" });

    expect(report.status).toBe("untested");
    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: "STELLAR_CLI_UNTESTED_VERSION",
        message: expect.stringContaining("Stellar CLI 26.0.0 is newer than the last-tested 25.2.0"),
      }),
    ]);
  });

  it("returns untested for the adjacent version above the last-tested", () => {
    const report = evaluateStellarCliCompatibility({ version: "25.2.1" });

    expect(report.status).toBe("untested");
    expect(report.warnings[0]?.code).toBe("STELLAR_CLI_UNTESTED_VERSION");
  });

  it("does not throw on a far-future version", () => {
    expect(() => evaluateStellarCliCompatibility({ version: "99.0.0" })).not.toThrow();
  });

  it("throws UNSUPPORTED_CLI_VERSION for versions below the hard floor", () => {
    expect(() => evaluateStellarCliCompatibility({ version: "22.8.1" })).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
        message: expect.stringContaining("below the supported minimum 23.0.0"),
      })
    );
  });

  it("throws UNSUPPORTED_CLI_VERSION for prereleases below the hard floor", () => {
    expect(() => evaluateStellarCliCompatibility({ version: "22.0.0-rc.1" })).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
      })
    );
  });

  it("throws STELLAR_CLI_VERSION_PARSE_FAILED for unparseable input", () => {
    expect(() => evaluateStellarCliCompatibility({ version: "not-a-version" })).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
      })
    );
  });

  it("uses the lastTestedVersion override for the untested boundary", () => {
    const report = evaluateStellarCliCompatibility({
      version: "25.2.0",
      lastTestedVersion: "24.0.0",
    });

    expect(report.status).toBe("untested");
    expect(report.lastTestedVersion).toBe("24.0.0");
  });

  it("falls back to the package default when the lastTestedVersion override is invalid", () => {
    const report = evaluateStellarCliCompatibility({
      version: "25.2.0",
      lastTestedVersion: "garbage",
    });

    expect(report.lastTestedVersion).toBe(STELLAR_CLI_LAST_TESTED_VERSION);
  });

  it("downgrades to untested when a required feature is missing", () => {
    const report = evaluateStellarCliCompatibility({
      version: "25.2.0",
      features: ["contract-invoke-sign"],
    });

    expect(report.status).toBe("untested");
    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: "STELLAR_CLI_MISSING_FEATURE",
        message: expect.stringContaining("contract-invoke-sign"),
      }),
    ]);
  });

  it("ignores empty feature entries", () => {
    const report = evaluateStellarCliCompatibility({
      version: "25.2.0",
      features: [""],
    });

    expect(report.status).toBe("supported");
    expect(report.warnings).toEqual([]);
  });

  it("parses prerelease + build-metadata versions end to end", () => {
    const version = parseStellarCliVersion("stellar 25.2.0+build.5");

    const report = evaluateStellarCliCompatibility({ version });
    expect(report.version).toBe("25.2.0+build.5");
    expect(report.status).toBe("supported");
  });
});
