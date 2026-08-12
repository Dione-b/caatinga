import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { registerDevCommand } from "./dev.command.js";

type CommandWithHidden = Command & { _hidden?: boolean };

describe("registerDevCommand", () => {
  it("should_register_dev_as_hidden", () => {
    const program = new Command();
    registerDevCommand(program);
    const dev = program.commands.find((command) => command.name() === "dev");
    expect((dev as CommandWithHidden)?._hidden).toBe(true);
  });

  it("should_opt_out_of_the_help_flag_as_a_pre_v1_stub", () => {
    const program = new Command();
    registerDevCommand(program);
    const dev = program.commands.find((command) => command.name() === "dev");

    expect(() => dev?.exitOverride().parse(["node", "dev", "--help"])).toThrowError(
      expect.objectContaining({ code: "commander.unknownOption" })
    );
  });
});
