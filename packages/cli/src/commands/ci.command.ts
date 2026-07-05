import { Command } from "commander";
import { execa } from "execa";
import { loadConfig, resolveNetwork } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerCiCommand(program: Command): void {
  const ci = program.command("ci").description("CI helper: doctor → smoke → optional checks");

  ci.command("run")
    .description("Run the default CI recipe for the current project")
    .option("-n, --network <network>", "Configured network name")
    .option("-s, --source <source>", "Stellar CLI identity alias")
    .option("--skip-smoke", "Skip smoke reads")
    .option("--strict", "Pass --strict to doctor and status-equivalent checks")
    .action(
      (options: { network?: string; source?: string; skipSmoke?: boolean; strict?: boolean }) =>
        runCliAction(async () => {
          const config = await loadConfig();
          const network = resolveNetwork(config, options.network);
          const strictFlags = options.strict ? ["--strict"] : [];

          logger.info("CI: doctor");
          await execa(
            "node",
            ["./dist/index.js", "doctor", "--network", network.name, ...strictFlags],
            {
              stdio: "inherit",
              cwd: process.cwd(),
            }
          ).catch(async () => {
            await execa("pnpm", ["dev", "doctor", "--network", network.name, ...strictFlags], {
              stdio: "inherit",
            });
          });

          if (!options.skipSmoke) {
            logger.info("");
            logger.info("CI: smoke");
            const smokeArgs = ["dev", "smoke", "--network", network.name];
            if (options.source) {
              smokeArgs.push("--source", options.source);
            }
            await execa("pnpm", smokeArgs, { stdio: "inherit" });
          }

          logger.success("CI recipe complete");
        })
    );
}
