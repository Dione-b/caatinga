import { describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("./run-command.js", () => ({
  runCommand,
}));

import { checkBinary } from "./check-binary.js";

describe("checkBinary", () => {
  it("skips the Stellar version gate because the real command validates it", async () => {
    runCommand.mockResolvedValueOnce({ stdout: "stellar 25.2.0", stderr: "", all: "" });

    await checkBinary("stellar", "hint");

    expect(runCommand).toHaveBeenCalledWith("stellar", ["--version"], {
      skipStellarVersionCheck: true,
    });
  });

  it("should_throw_RUST_NOT_FOUND_when_rustc_is_missing", async () => {
    runCommand.mockRejectedValueOnce(new Error("not found"));

    await expect(checkBinary("rustc", "hint")).rejects.toMatchObject({
      code: CaatingaErrorCode.RUST_NOT_FOUND,
    });

    expect(runCommand).toHaveBeenCalledWith("rustc", ["--version"], {});
  });
});
