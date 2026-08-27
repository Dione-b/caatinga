import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock,
}));

import { checkStellarCliVersion } from "./check-stellar-cli-version.js";
import { parseStellarCliVersion } from "./version.js";

describe("checkStellarCliVersion", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
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
    runCommandMock.mockRejectedValueOnce(
      new CaatingaError(
        "Stellar CLI was not found.",
        CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
        "Install Stellar CLI before running Caatinga-backed commands."
      )
    );

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
