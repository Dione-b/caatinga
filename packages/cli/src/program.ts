import { Command } from "commander";
import { registerBuildCommand } from "./commands/build.command.js";
import { registerDeployCommand } from "./commands/deploy.command.js";
import { registerDevCommand } from "./commands/dev.command.js";
import { registerDoctorCommand } from "./commands/doctor.command.js";
import { registerGenerateCommand } from "./commands/generate.command.js";
import { registerInitCommand } from "./commands/init.command.js";
import { registerInvokeCommand } from "./commands/invoke.command.js";
import { CAATINGA_CLI_VERSION } from "./version.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("caatinga")
    .description("Developer toolkit for Stellar/Soroban dApps")
    .version(CAATINGA_CLI_VERSION);

  registerInitCommand(program);
  registerDevCommand(program);
  registerDoctorCommand(program);
  registerBuildCommand(program);
  registerDeployCommand(program);
  registerGenerateCommand(program);
  registerInvokeCommand(program);

  return program;
}
