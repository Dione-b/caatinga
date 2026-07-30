import path from "node:path";
import { Command } from "commander";
import { registerBuildCommand } from "./commands/build.command.js";
import { registerDeployCommand } from "./commands/deploy.command.js";
import { registerUpgradeCommand } from "./commands/upgrade.command.js";
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
import { registerSmokeCommand } from "./commands/smoke.command.js";
import { registerRegressionCommand } from "./commands/regression.command.js";
import { registerCiCommand } from "./commands/ci.command.js";
import { registerIdentityCommand } from "./commands/identity.command.js";
import { registerVersionCommand } from "./commands/version.command.js";
import { CAATINGA_CLI_VERSION } from "./version.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name(path.basename(process.argv[1] ?? "caatinga").replace(/\.(js|ts)$/, ""))
    .description("Developer toolkit for Stellar/Soroban dApps")
    .version(CAATINGA_CLI_VERSION, "-v, --version", "Output the current version")
    .configureHelp({
      formatHelp(cmd, helper) {
        if (cmd.parent !== null) {
          return helper.formatHelp(cmd, helper);
        }

        const categories: Record<string, string[]> = {
          "Scaffolding & Setup": ["init", "setup", "identity"],
          "Build & Compilation": ["build"],
          "Deployment & Lifecycle": ["deploy", "upgrade", "rollback", "wire"],
          "Query & Execution": ["read", "invoke", "estimate", "dev"],
          "Status & Diagnostics": ["status", "inspect", "doctor", "sync-env", "migrate", "version"],
          "Zero-Knowledge (ZK) Proofs": ["zk"],
          "Automation & CI": ["smoke", "regression", "ci"],
        };

        const commandList = cmd.commands;
        const result: string[] = [];

        result.push(helper.commandDescription(cmd));
        result.push("");
        result.push(helper.commandUsage(cmd));
        result.push("");
        result.push("Commands (by domain):");

        for (const [groupName, commandNames] of Object.entries(categories)) {
          const matchedCommands = commandList.filter((c) => commandNames.includes(c.name()));
          if (matchedCommands.length > 0) {
            result.push(`\n  ${groupName}:`);
            for (const subCmd of matchedCommands) {
              const term = subCmd.name();
              const description = helper.commandDescription(subCmd);
              result.push(`    ${term.padEnd(20)} ${description}`);
            }
          }
        }

        const allConfiguredNames = Object.values(categories).flat();
        const otherCommands = commandList.filter((c) => !allConfiguredNames.includes(c.name()));
        if (otherCommands.length > 0) {
          result.push(`\n  Other Commands:`);
          for (const subCmd of otherCommands) {
            const term = subCmd.name();
            const description = helper.commandDescription(subCmd);
            result.push(`    ${term.padEnd(20)} ${description}`);
          }
        }

        result.push("");
        const optionTermLength = helper.longestOptionTermLength(cmd, helper);
        if (optionTermLength > 0) {
          result.push("Options:");
          const visibleOptions = helper.visibleOptions(cmd);
          for (const option of visibleOptions) {
            const term = helper.optionTerm(option);
            const description = helper.optionDescription(option);
            result.push(`  ${term.padEnd(optionTermLength + 2)} ${description}`);
          }
        }

        return result.join("\n");
      },
    });

  registerInitCommand(program);
  registerZkInitCommand(program);
  registerZkBuildCommand(program);
  registerZkProveCommand(program);
  registerZkInvokeCommand(program);
  registerDevCommand(program);
  registerDoctorCommand(program);
  registerBuildCommand(program);
  registerDeployCommand(program);
  registerUpgradeCommand(program);
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
  registerSmokeCommand(program);
  registerRegressionCommand(program);
  registerCiCommand(program);
  registerIdentityCommand(program);
  registerVersionCommand(program);

  return program;
}
