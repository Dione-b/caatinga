import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock,
}));

import { STELLAR_CLI_REQUIRED_FEATURES } from "./probe-stellar-cli-features.js";

describe("probeMissingStellarCliFeatures", () => {
  beforeEach(() => {
    vi.resetModules();
    runCommandMock.mockReset();
  });

  async function loadProbe() {
    return (await import("./probe-stellar-cli-features.js")).probeMissingStellarCliFeatures;
  }

  it("returns the missing feature ids", async () => {
    runCommandMock
      .mockResolvedValueOnce({ stdout: "ok", stderr: "", all: "ok" })
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce({ stdout: "ok", stderr: "", all: "ok" });
    const probe = await loadProbe();

    await expect(probe("25.2.0", "/project")).resolves.toEqual(["contract-deploy"]);
  });

  it("reuses feature probes for the same version and working directory", async () => {
    runCommandMock.mockResolvedValue({ stdout: "ok", stderr: "", all: "ok" });
    const probe = await loadProbe();

    await probe("25.2.0", "/project");
    await probe("25.2.0", "/project");

    expect(runCommandMock).toHaveBeenCalledTimes(STELLAR_CLI_REQUIRED_FEATURES.length);
  });

  it("does not share feature probes between working directories", async () => {
    runCommandMock.mockResolvedValue({ stdout: "ok", stderr: "", all: "ok" });
    const probe = await loadProbe();

    await probe("25.2.0", "/project-a");
    await probe("25.2.0", "/project-b");

    expect(runCommandMock).toHaveBeenCalledTimes(STELLAR_CLI_REQUIRED_FEATURES.length * 2);
  });

  it("does not probe features below the minimum version", async () => {
    const probe = await loadProbe();

    await expect(probe("22.0.1", "/project")).resolves.toEqual(["contract-invoke-sign"]);
    expect(runCommandMock).not.toHaveBeenCalled();
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
