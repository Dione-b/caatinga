import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";

const execaMock = vi.hoisted(() => vi.fn());
const runCommandMock = vi.hoisted(() => vi.fn());
const checkStellarCliVersionMock = vi.hoisted(() => vi.fn());

describe("checkStellarCliVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    runCommandMock.mockReset();
  });

  it("checks stellar --version and returns a compatibility report", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: runCommandMock,
    }));
    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    const report = await checkStellarCliVersion();
    expect(report.status).toBe("supported");
    expect(report.version).toBe("25.2.0");
    expect(runCommandMock).toHaveBeenCalledWith("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
  });

  it("normalizes missing stellar binary to CAATINGA_STELLAR_CLI_NOT_FOUND", async () => {
    vi.doMock("../shell/run-command.js", () => ({
      runCommand: runCommandMock,
    }));
    const { checkStellarCliVersion } = await import("./check-stellar-cli-version.js");
    runCommandMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }));

    await expect(checkStellarCliVersion()).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
    });
  });
});

describe("runCommand Stellar CLI version gate", () => {
  beforeEach(() => {
    vi.resetModules();
    execaMock.mockReset();
    checkStellarCliVersionMock.mockReset();
    vi.doUnmock("../shell/run-command.js");
    vi.doMock("execa", () => ({
      execa: execaMock,
    }));
    vi.doMock("./check-stellar-cli-version.js", () => ({
      checkStellarCliVersion: checkStellarCliVersionMock,
    }));
  });

  it("checks the Stellar CLI version before running stellar commands", async () => {
    const { runCommand } = await import("../shell/run-command.js");
    checkStellarCliVersionMock.mockResolvedValueOnce({
      version: "25.2.0",
      status: "supported",
      minVersion: "23.0.0",
      lastTestedVersion: "25.2.0",
      warnings: [],
    });
    execaMock.mockResolvedValueOnce({ stdout: "ok", stderr: "", all: "ok" });

    await expect(runCommand("stellar", ["contract", "build"])).resolves.toEqual({
      stdout: "ok",
      stderr: "",
      all: "ok",
    });

    expect(checkStellarCliVersionMock).toHaveBeenCalledWith();
    expect(execaMock).toHaveBeenCalledWith("stellar", ["contract", "build"], {
      cwd: undefined,
      env: expect.objectContaining({ PATH: expect.any(String) }),
      all: true,
      reject: true,
    });
  });

  it("skips the Stellar CLI version gate when requested by the version check itself", async () => {
    const { runCommand } = await import("../shell/run-command.js");
    execaMock.mockResolvedValueOnce({
      stdout: "stellar 22.0.1",
      stderr: "",
      all: "stellar 22.0.1",
    });

    await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });

    expect(checkStellarCliVersionMock).not.toHaveBeenCalled();
  });

  it("normalizes missing stellar binary to CAATINGA_STELLAR_CLI_NOT_FOUND", async () => {
    const { runCommand } = await import("../shell/run-command.js");
    checkStellarCliVersionMock.mockResolvedValueOnce({
      version: "25.2.0",
      status: "supported",
      minVersion: "23.0.0",
      lastTestedVersion: "25.2.0",
      warnings: [],
    });
    execaMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }));

    await expect(runCommand("stellar", ["contract", "build"])).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
    });
  });

  it("preserves CaatingaError codes from the version gate", async () => {
    const { CaatingaError } = await import("../errors/CaatingaError.js");
    const { runCommand } = await import("../shell/run-command.js");
    checkStellarCliVersionMock.mockRejectedValueOnce(
      new CaatingaError(
        "Stellar CLI 22.0.1 is below the supported minimum 23.0.0.",
        CaatingaErrorCode.UNSUPPORTED_CLI_VERSION
      )
    );

    await expect(runCommand("stellar", ["contract", "build"])).rejects.toMatchObject({
      code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
    });
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("blocks deploy when stellar --version reports a version below the hard floor", async () => {
    vi.doUnmock("./check-stellar-cli-version.js");
    const { runCommand } = await import("../shell/run-command.js");
    execaMock.mockResolvedValueOnce({
      stdout: "stellar 22.0.1",
      stderr: "",
      all: "stellar 22.0.1",
    });

    await expect(runCommand("stellar", ["contract", "deploy"])).rejects.toMatchObject({
      code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
      message: expect.stringContaining("below the supported minimum 23.0.0"),
    });

    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalledWith("stellar", ["--version"], {
      cwd: undefined,
      env: expect.objectContaining({ PATH: expect.any(String) }),
      all: true,
      reject: true,
    });
  });
});
