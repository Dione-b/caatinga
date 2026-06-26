import { Command } from "commander";
import { registerBuildCommand } from "./commands/build.command.js";
import { registerDeployCommand } from "./commands/deploy.command.js";
import { registerDevCommand } from "./commands/dev.command.js";
import { registerDoctorCommand } from "./commands/doctor.command.js";
import { registerGenerateCommand } from "./commands/generate.command.js";
import { registerInitCommand } from "./commands/init.command.js";
import { registerZkInitCommand } from "./commands/zk-init.command.js";
import { registerZkBuildCommand } from "./commands/zk-build.command.js";
import { registerZkProveCommand } from "./commands/zk-prove.command.js";
import { registerZkInvokeCommand } from "./commands/zk-invoke.command.js";
import { registerInvokeCommand } from "./commands/invoke.command.js";
import { registerReadCommand } from "./commands/read.command.js";
import { registerStatusCommand } from "./commands/status.command.js";
import { registerMigrateCommand } from "./commands/migrate.command.js";
import { registerRollbackCommand } from "./commands/rollback.command.js";
import { registerEstimateCommand } from "./commands/estimate.command.js";
import { registerInspectCommand } from "./commands/inspect.command.js";
import { registerSetupCommand } from "./commands/setup.command.js";
import { registerWireCommand } from "./commands/wire.command.js";
import { registerSyncEnvCommand } from "./commands/sync-env.command.js";
import { CAATINGA_CLI_VERSION } from "./version.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("caatinga")
    .description("Developer toolkit for Stellar/Soroban dApps")
    .version(CAATINGA_CLI_VERSION);

  registerInitCommand(program);
  registerZkInitCommand(program);
  registerZkBuildCommand(program);
  registerZkProveCommand(program);
  registerZkInvokeCommand(program);
  registerDevCommand(program);
  registerDoctorCommand(program);
  registerBuildCommand(program);
  registerDeployCommand(program);
  registerGenerateCommand(program);
  registerInvokeCommand(program);
  registerReadCommand(program);
  registerStatusCommand(program);
  registerMigrateCommand(program);
  registerRollbackCommand(program);
  registerEstimateCommand(program);
  registerInspectCommand(program);
  registerSetupCommand(program);
  registerWireCommand(program);
  registerSyncEnvCommand(program);

  return program;
}
