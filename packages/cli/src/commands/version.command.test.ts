import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerVersionCommand } from "./version.command.js";

const reportCliVersionChannelMock = vi.hoisted(() => vi.fn());

vi.mock("./doctor-cli-version.js", () => ({
  reportCliVersionChannel: reportCliVersionChannelMock,
}));

function createVersionProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerVersionCommand(program);
  return program;
}

describe("version command", () => {
  beforeEach(() => {
    reportCliVersionChannelMock.mockReset();
    reportCliVersionChannelMock.mockResolvedValue({ note: undefined });
    process.exitCode = undefined;
  });

  it("should_print_the_running_version_and_check_the_release_channel", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createVersionProgram().parseAsync(["node", "caatinga", "version"]);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("@caatinga/cli: "));
      expect(reportCliVersionChannelMock).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
    } finally {
      logSpy.mockRestore();
    }
  });
});
