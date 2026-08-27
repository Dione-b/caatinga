import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock,
}));

import {
  checkStellarCliVersion,
  _clearStellarCliVersionCache,
} from "./check-stellar-cli-version.js";
import { parseStellarCliVersion } from "./version.js";

describe("checkStellarCliVersion", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    _clearStellarCliVersionCache();
  });

  it("returns a supported report for the last-tested version", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    const report = await checkStellarCliVersion();

    expect(report.status).toBe("supported");
    expect(report.version).toBe("25.2.0");
    expect(report.warnings).toEqual([]);
    expect(runCommandMock).toHaveBeenCalledWith("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
  });

  it("emits a warning via the onWarning hook for newer-than-tested versions", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar 99.0.0",
      stderr: "",
      all: "stellar 99.0.0",
    });

    const onWarning = vi.fn();
    const report = await checkStellarCliVersion({ onWarning });

    expect(report.status).toBe("untested");
    expect(report.version).toBe("99.0.0");
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STELLAR_CLI_UNTESTED_VERSION" })
    );
  });

  it("writes the default warning to stderr when no hook is provided", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar 28.0.0",
      stderr: "",
      all: "stellar 28.0.0",
    });

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const report = await checkStellarCliVersion();
      expect(report.status).toBe("untested");
      expect(stderrSpy).toHaveBeenCalled();
      const payload = stderrSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(payload).toContain("Stellar CLI 28.0.0");
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("throws UNSUPPORTED_CLI_VERSION for versions below the hard floor", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar 22.0.1",
      stderr: "",
      all: "stellar 22.0.1",
    });

    await expect(checkStellarCliVersion()).rejects.toMatchObject({
      code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
      message: expect.stringContaining("below the supported minimum 23.0.0"),
    });
  });

  it("normalizes missing stellar binary to CAATINGA_STELLAR_CLI_NOT_FOUND", async () => {
    runCommandMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }));

    await expect(checkStellarCliVersion()).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
    });
  });

  it("surfaces parse failures from raw output", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar dev build",
      stderr: "",
      all: "stellar dev build",
    });

    expect(() => parseStellarCliVersion("stellar dev build")).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
      })
    );

    await expect(checkStellarCliVersion()).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
    });
  });
});

// Memoization tests use fresh module state via vi.resetModules().
const memoRunCommandMock = vi.hoisted(() => vi.fn());

describe("checkStellarCliVersion memoization", () => {
  beforeEach(() => {
    vi.resetModules();
    memoRunCommandMock.mockReset();
  });

  it("runs stellar --version only once and returns the cached report on subsequent calls", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    const report1 = await checkStellarCliVersion();
    const report2 = await checkStellarCliVersion();

    expect(report1.version).toBe("25.2.0");
    expect(report2.version).toBe(report1.version);
    expect(report1.status).toBe("supported");
    // The --version subprocess is memoized and the per-version feature probe
    // results are cached, so the second call spawns nothing:
    // 1 --version call + 3 feature probes = 4 total.
    expect(stellarVersionProbeCount()).toBe(1);
    expect(memoRunCommandMock).toHaveBeenCalledTimes(4);
  });

  it("still emits warnings on each call when returning from cache", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 28.0.0",
      stderr: "",
      all: "stellar 28.0.0",
    });

    const onWarning1 = vi.fn();
    const onWarning2 = vi.fn();

    const report1 = await checkStellarCliVersion({ onWarning: onWarning1 });
    const report2 = await checkStellarCliVersion({ onWarning: onWarning2 });

    expect(report1.version).toBe(report2.version);
    expect(report1.status).toBe("untested");
    expect(onWarning1).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STELLAR_CLI_UNTESTED_VERSION" })
    );
    expect(onWarning2).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STELLAR_CLI_UNTESTED_VERSION" })
    );
    // The --version subprocess is memoized and the per-version feature probe
    // results are cached, so the second call spawns nothing.
    expect(stellarVersionProbeCount()).toBe(1);
    expect(memoRunCommandMock).toHaveBeenCalledTimes(4);
  });

  it("does not cache errors — a second call retries stellar --version", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockRejectedValueOnce(
      Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" })
    );

    await expect(checkStellarCliVersion()).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
    });

    // Second call should try again (not return a cached error)
    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    const report = await checkStellarCliVersion();
    expect(report.status).toBe("supported");
    // 1 failed call + (1 --version + 3 feature probes) = 5 total.
    expect(memoRunCommandMock).toHaveBeenCalledTimes(5);
  });

  it("does not reuse the CompatibilityReport when features differ between calls (regression)", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    // First call: no extra features
    const report1 = await checkStellarCliVersion();
    expect(report1.warnings.filter((w) => w.code === "STELLAR_CLI_MISSING_FEATURE")).toHaveLength(
      0
    );

    // Second call: request a feature that doesn't exist — must produce a warning
    const report2 = await checkStellarCliVersion({ features: ["nonexistent-feature"] });
    const featureWarnings2 = report2.warnings.filter(
      (w) => w.code === "STELLAR_CLI_MISSING_FEATURE"
    );
    expect(featureWarnings2).toHaveLength(1);
    expect(featureWarnings2[0].message).toContain("nonexistent-feature");

    // Third call: different features — must reflect its own options, not previous ones
    const report3 = await checkStellarCliVersion({ features: ["another-feature"] });
    const featureWarnings3 = report3.warnings.filter(
      (w) => w.code === "STELLAR_CLI_MISSING_FEATURE"
    );
    expect(featureWarnings3).toHaveLength(1);
    expect(featureWarnings3[0].message).toContain("another-feature");
    expect(featureWarnings3[0].message).not.toContain("nonexistent-feature");

    // Only one --version subprocess should have been spawned across all three calls
    expect(stellarVersionProbeCount()).toBe(1);
  });

  it("respects different lastTestedVersion values on each call (regression)", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    // First call: version 25.2.0 is within lastTestedVersion 26.0.0 — supported
    const report1 = await checkStellarCliVersion({ lastTestedVersion: "26.0.0" });
    expect(report1.status).toBe("supported");
    expect(report1.lastTestedVersion).toBe("26.0.0");
    expect(report1.warnings).toHaveLength(0);

    // Second call: same version but lastTestedVersion 24.0.0 — untested (25.2.0 > 24.0.0)
    const report2 = await checkStellarCliVersion({ lastTestedVersion: "24.0.0" });
    expect(report2.status).toBe("untested");
    expect(report2.lastTestedVersion).toBe("24.0.0");
    expect(report2.warnings).toHaveLength(1);
    expect(report2.warnings[0].code).toBe("STELLAR_CLI_UNTESTED_VERSION");

    // Only one --version subprocess across both calls
    expect(stellarVersionProbeCount()).toBe(1);
  });

  it("respects probeFeatures: false on a subsequent call (regression)", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    // First call: default probeFeatures (true) — triggers feature probing
    const report1 = await checkStellarCliVersion();
    expect(report1.version).toBe("25.2.0");
    const callsAfterFirst = memoRunCommandMock.mock.calls.length;

    // Second call: probeFeatures: false — must NOT trigger feature probes
    const report2 = await checkStellarCliVersion({ probeFeatures: false });
    expect(report2.version).toBe("25.2.0");
    // No additional calls should have been made (version is cached, probes skipped)
    expect(memoRunCommandMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("cache invalidation forces a fresh version probe", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion, _clearStellarCliVersionCache } =
      await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    await checkStellarCliVersion();
    expect(stellarVersionProbeCount()).toBe(1);

    // Clear the cache
    _clearStellarCliVersionCache();

    await checkStellarCliVersion();
    // After invalidation, a fresh --version probe should occur
    expect(stellarVersionProbeCount()).toBe(2);
  });

  it("caches the version string, not the full CompatibilityReport (regression)", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: memoRunCommandMock,
    }));

    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");

    memoRunCommandMock.mockResolvedValue({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    const report1 = await checkStellarCliVersion();
    const report2 = await checkStellarCliVersion({ lastTestedVersion: "24.0.0" });

    // The two reports must be different objects with different evaluation results
    expect(report1).not.toBe(report2);
    expect(report1.status).toBe("supported");
    expect(report2.status).toBe("untested");
    expect(report1.warnings).toHaveLength(0);
    expect(report2.warnings).toHaveLength(1);
    // The version is the same because it was cached
    expect(report1.version).toBe(report2.version);
    // Only one --version subprocess was spawned
    expect(stellarVersionProbeCount()).toBe(1);
  });

  function stellarVersionProbeCount(): number {
    return memoRunCommandMock.mock.calls.filter(
      (call) => Array.isArray(call[1]) && call[1][0] === "--version"
    ).length;
  }
});
