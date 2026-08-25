import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.hoisted(() => vi.fn());
const probeMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./probe-stellar-cli-features.js", () => ({
  probeMissingStellarCliFeatures: probeMock,
}));

import {
  checkStellarCliVersion,
  resetStellarCliVersionCache,
} from "./check-stellar-cli-version.js";

describe("checkStellarCliVersion memoization (#143)", () => {
  beforeEach(() => {
    resetStellarCliVersionCache();
    runCommandMock.mockReset();
    runCommandMock.mockResolvedValue({ stdout: "stellar 27.0.0", stderr: "", all: "stellar 27.0.0" });
    probeMock.mockReset();
    probeMock.mockResolvedValue([]);
  });

  it("runs the version probe once for repeated plain calls", async () => {
    await checkStellarCliVersion();
    await checkStellarCliVersion();
    await checkStellarCliVersion();

    // Without memoization each plain call spawns `stellar --version` and the
    // feature probes; memoized, the whole cascade runs a single time.
    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(probeMock).toHaveBeenCalledTimes(1);
  });

  it("shares a single in-flight probe across concurrent plain calls", async () => {
    await Promise.all([
      checkStellarCliVersion(),
      checkStellarCliVersion(),
      checkStellarCliVersion(),
    ]);

    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(probeMock).toHaveBeenCalledTimes(1);
  });

  it("re-probes after the cache is reset", async () => {
    await checkStellarCliVersion();
    resetStellarCliVersionCache();
    await checkStellarCliVersion();

    expect(runCommandMock).toHaveBeenCalledTimes(2);
  });

  it("does not memoize calls that pass explicit options", async () => {
    const onWarning = vi.fn();
    await checkStellarCliVersion({ onWarning });
    await checkStellarCliVersion({ onWarning });

    expect(runCommandMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed probe", async () => {
    runCommandMock.mockRejectedValueOnce(new Error("boom"));
    await expect(checkStellarCliVersion()).rejects.toThrow("boom");

    // A later call must retry rather than replay the cached rejection.
    await checkStellarCliVersion();
    expect(runCommandMock).toHaveBeenCalledTimes(2);
  });
});
