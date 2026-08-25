import { type Command } from "commander";
import { CAATINGA_CLI_VERSION } from "../version.js";
import { logger } from "../utils/logger.js";
import { runCliAction } from "../utils/errors.js";
import { reportCliVersionChannel } from "./doctor-cli-version.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Show the version of Caatinga CLI")
    // Return the promise so Commander awaits the registry check before the
    // process is allowed to exit.
    .action(() =>
      runCliAction(async () => {
        logger.info(`@caatinga/cli: ${CAATINGA_CLI_VERSION}`);
        // Advisory only: notes when this install is ahead of the npm `latest`
        // dist-tag (for example a `next`-tagged pre-release) or behind it.
        await reportCliVersionChannel();
      })
    );
}
