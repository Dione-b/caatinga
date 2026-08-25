import { beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "./run-command.js";

vi.mock("execa", () => ({ execa: vi.fn() }));

const execaMock = vi.mocked(execa);

describe("runCommand failureCode", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  it("should_throw_with_provided_failureCode_when_execa_rejects", async () => {
    execaMock.mockRejectedValueOnce({ all: "boom", code: 1 });

    await expect(
      runCommand("false", [], {
        skipStellarVersionCheck: true,
        failureCode: CaatingaErrorCode.BUILD_FAILED,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.BUILD_FAILED,
    });
  });

  it("should_default_to_COMMAND_FAILED_when_failureCode_is_absent", async () => {
    execaMock.mockRejectedValueOnce({ all: "boom", code: 1 });

    await expect(runCommand("false", [], { skipStellarVersionCheck: true })).rejects.toMatchObject({
      code: CaatingaErrorCode.COMMAND_FAILED,
    });
  });

  // #145
  it("should_surface_COMMAND_TIMEOUT_when_execa_reports_a_timeout", async () => {
    execaMock.mockRejectedValueOnce({ timedOut: true, all: "" });

    await expect(
      runCommand("npm", ["view", "pkg"], { skipStellarVersionCheck: true, timeout: 60_000 })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.COMMAND_TIMEOUT });
  });

  it("should_pass_the_timeout_through_to_execa", async () => {
    execaMock.mockResolvedValueOnce({ stdout: "ok", stderr: "", all: "ok" } as never);

    await runCommand("node", ["-v"], { skipStellarVersionCheck: true, timeout: 1234 });

    expect(execaMock).toHaveBeenCalledWith(
      "node",
      ["-v"],
      expect.objectContaining({ timeout: 1234 })
    );
  });
});
