import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock,
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

describe("checkStellarSdkVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    runCommandMock.mockReset();
    readFileMock.mockReset();
    readFileMock.mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOENT" }));
  });

  async function loadCheckStellarSdkVersion() {
    return (await import("./check-stellar-sdk-version.js")).checkStellarSdkVersion;
  }

  it("emits a warning via the onWarning hook for newer-than-tested versions", async () => {
    runCommandMock.mockResolvedValueOnce({ stdout: "99.0.0", stderr: "", all: "99.0.0" });
    const checkStellarSdkVersion = await loadCheckStellarSdkVersion();
    const onWarning = vi.fn();

    const report = await checkStellarSdkVersion({ onWarning });

    expect(report.version).toBe("99.0.0");
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(onWarning).toHaveBeenCalledWith(report.warnings[0]);
  });

  it("silently drops warnings when no onWarning hook is provided", async () => {
    runCommandMock.mockResolvedValueOnce({ stdout: "99.0.0", stderr: "", all: "99.0.0" });
    const checkStellarSdkVersion = await loadCheckStellarSdkVersion();
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const report = await checkStellarSdkVersion();
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("writes formatted warning lines to stderr via emitStellarSdkWarningToStderr", async () => {
    runCommandMock.mockResolvedValueOnce({ stdout: "99.0.0", stderr: "", all: "99.0.0" });
    const { checkStellarSdkVersion, emitStellarSdkWarningToStderr } =
      await import("./check-stellar-sdk-version.js");
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const report = await checkStellarSdkVersion({ onWarning: emitStellarSdkWarningToStderr });

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const written = stderrSpy.mock.calls[0][0];
      expect(written).toContain("Warning:");
      expect(written).toContain(report.warnings[0].message);
      if (report.warnings[0].remediation) {
        expect(written).toContain(report.warnings[0].remediation);
      }
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
