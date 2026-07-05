import { Command } from "commander";
import { describeCliSource, loadConfig, runSmokeReads } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerSmokeCommand(program: Command): void {
  program
    .command("smoke")
    .description("Run configured read-only smoke checks with postDeploy expect DSL")
    .option("-n, --network <network>", "Configured network name")
    .option(
      "-s, --source <source>",
      "Stellar CLI identity alias for simulation context (defaults to CAATINGA_SOURCE, otherwise alice)"
    )
    .action((options: { network?: string; source?: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const resolvedSource = describeCliSource(options.source);
        if (resolvedSource.origin !== "explicit") {
          logger.info(`Using source identity "${resolvedSource.source}".`);
        }

        const results = await runSmokeReads({
          config,
          networkName: options.network,
          source: options.source,
        });

        let failed = 0;
        for (const result of results) {
          if (result.passed) {
            logger.success(`${result.contract}.${result.method}`);
          } else {
            failed += 1;
            logger.error(`${result.contract}.${result.method} — expect failed`);
            if (result.result) {
              logger.info(`  got: ${result.result}`);
            }
          }
        }

        if (failed > 0) {
          process.exitCode = 1;
          return;
        }

        logger.success(`Smoke passed (${results.length} read${results.length === 1 ? "" : "s"})`);
      })
    );
}
