import { Command } from "commander";
import { migrateArtifactsFile } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerMigrateCommand(program: Command): void {
  const migrate = program.command("migrate").description("Migrate local Caatinga project files");

  migrate
    .command("artifacts")
    .description("Upgrade caatinga.artifacts.json to the current schema version")
    .action(() =>
      runCliAction(async () => {
        const result = await migrateArtifactsFile();

        if (!result.migrated) {
          logger.info("Artifacts already at current schema version.");
          return;
        }

        logger.success(`Artifacts migrated to v${result.artifacts.version}`);
        logger.info(`Updated: ${result.path}`);
      })
    );
}
