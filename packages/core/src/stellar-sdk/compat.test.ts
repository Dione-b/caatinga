import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  STELLAR_SDK_LAST_TESTED_VERSION,
  STELLAR_SDK_MIN_VERSION,
  evaluateStellarSdkCompatibility,
  parseStellarSdkVersion,
} from "./compat.js";

describe("evaluateStellarSdkCompatibility", () => {
  it("declares the hard floor and the advisory last-tested version", () => {
    expect(STELLAR_SDK_MIN_VERSION).toBe("16.0.1");
    expect(STELLAR_SDK_LAST_TESTED_VERSION).toBe("16.0.1");
  });

  it("returns supported with no warnings for the last-tested version", () => {
    const report = evaluateStellarSdkCompatibility({ version: "16.0.1" });

    expect(report).toEqual({
      version: "16.0.1",
      status: "supported",
      minVersion: "16.0.1",
      lastTestedVersion: "16.0.1",
      warnings: [],
    });
  });

  it("returns untested with a warning for a version above the last-tested", () => {
    const report = evaluateStellarSdkCompatibility({ version: "17.0.0" });

    expect(report.status).toBe("untested");
    expect(report.warnings[0]?.code).toBe("STELLAR_SDK_UNTESTED_VERSION");
  });

  it("throws UNSUPPORTED_SDK_VERSION for versions below the hard floor", () => {
    expect(() => evaluateStellarSdkCompatibility({ version: "15.0.0" })).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.UNSUPPORTED_SDK_VERSION,
      })
    );
  });

  it("throws STELLAR_SDK_VERSION_PARSE_FAILED for unparseable input", () => {
    expect(() => evaluateStellarSdkCompatibility({ version: "not-a-version" })).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.STELLAR_SDK_VERSION_PARSE_FAILED,
      })
    );
  });

  it("parses version strings from npm output", () => {
    expect(parseStellarSdkVersion("16.0.1")).toBe("16.0.1");
    expect(parseStellarSdkVersion("  16.0.1\n")).toBe("16.0.1");
  });
});
