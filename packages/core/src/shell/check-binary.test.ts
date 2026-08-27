import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("./run-command.js", () => ({
  runCommand,
}));

import { checkBinary } from "./check-binary.js";

describe("checkBinary", () => {
  beforeEach(() => {
    runCommand.mockReset();
  });

  it("should_throw_RUST_NOT_FOUND_when_rustc_is_missing", async () => {
    runCommand.mockRejectedValueOnce(new Error("not found"));

    await expect(checkBinary("rustc", "hint")).rejects.toMatchObject({
      code: CaatingaErrorCode.RUST_NOT_FOUND,
    });

    expect(runCommand).toHaveBeenCalledWith("rustc", ["--version"], {
      skipStellarVersionCheck: undefined,
    });
  });

  it("passes skipStellarVersionCheck: true when checking the stellar binary", async () => {
    runCommand.mockResolvedValueOnce({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    await checkBinary("stellar", "hint");

    expect(runCommand).toHaveBeenCalledWith("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
  });

  it("preserves explicit skipStellarVersionCheck for non-stellar binaries", async () => {
    runCommand.mockResolvedValueOnce({ stdout: "rustc 1.85.0", stderr: "", all: "rustc 1.85.0" });

    await checkBinary("rustc", "hint", { skipStellarVersionCheck: false });

    expect(runCommand).toHaveBeenCalledWith("rustc", ["--version"], {
      skipStellarVersionCheck: false,
    });
  });

  it("ignores explicit skipStellarVersionCheck: false for stellar binary", async () => {
    runCommand.mockResolvedValueOnce({
      stdout: "stellar 25.2.0",
      stderr: "",
      all: "stellar 25.2.0",
    });

    await checkBinary("stellar", "hint", { skipStellarVersionCheck: false });

    // Stellar always skips version check; explicit false is overridden.
    expect(runCommand).toHaveBeenCalledWith("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
  });
});
