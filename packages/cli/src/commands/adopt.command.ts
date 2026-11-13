import { Command } from "commander";
import { adoptProject } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

type AdoptOptions = {
  network?: string;
  projectName?: string;
  contractId?: string;
  name?: string;
  force?: boolean;
};

export function registerAdoptCommand(program: Command): void {
  program
    .command("adopt")
    .description(
      "Adopt Caatinga in an existing Soroban project: discover the Cargo workspace and write config + artifacts without overwriting anything"
    )
    .option("-n, --network <network>", "Configured network name")
    .option("--project-name <name>", "Project name recorded in caatinga.config.ts / artifacts")
    .option(
      "-c, --contract-id <id>",
      "Already-deployed contract ID to import (wasmHash is re-derived on-chain)"
    )
    .option("--name <name>", "Name under which --contract-id is recorded")
    .option(
      "--force",
      "Replace the existing artifact entry for --contract-id instead of skipping it"
    )
    .action((options: AdoptOptions) =>
      runCliAction(async () => {
        const imports =
          options.contractId !== undefined
            ? [{ name: options.name, contractId: options.contractId }]
            : [];

        const result = await adoptProject({
          cwd: process.cwd(),
          projectName: options.projectName,
          networkName: options.network,
          imports,
          force: options.force,
        });

        logger.info(`Adopting Soroban workspace at ${result.workspaceRoot}`);
        logger.info(`Network: ${result.network}`);
        logger.info(
          result.configWritten
            ? `Wrote caatinga.config.ts (project "${result.projectName}")`
            : "caatinga.config.ts already exists — left untouched"
        );
        logger.info(
          result.artifactsAlreadyExisted
            ? "caatinga.artifacts.json merged (existing entries were kept)"
            : "Wrote caatinga.artifacts.json"
        );

        if (result.discoveredContracts.length > 0) {
          logger.info("Contracts discovered in the Cargo workspace:");
          for (const contract of result.discoveredContracts) {
            logger.info(
              `  ${contract.name} (${contract.wasmOnDisk ? "wasm on disk" : "wasm not built yet — run ctg build"})`
            );
          }
        }

        for (const name of result.importedContracts) {
          logger.info(`Imported contract "${name}" from on-chain state`);
        }
        for (const name of result.replacedContracts) {
          logger.info(`Replaced existing artifact entry for "${name}" (--force)`);
        }
        for (const name of result.skippedContracts) {
          logger.info(
            `Skipped "${name}" — an artifact entry already exists (use --force to replace)`
          );
        }

        if (result.importedContracts.length === 0) {
          logger.info(
            "Deployed contracts can be imported with: ctg adopt --contract-id <C...> [--name <name>]"
          );
        }
      })
    );
}
