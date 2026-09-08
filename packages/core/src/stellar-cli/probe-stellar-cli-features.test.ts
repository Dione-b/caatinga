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
