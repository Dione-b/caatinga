import { Command } from "commander";
import { execa } from "execa";
import {
  buildWorkspace,
  deployContractGraph,
  generateBindingsGraph,
  loadConfig,
  resolveNetwork,
  runSmokeReads,
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerRegressionCommand(program: Command): void {
  program
    .command("regression")
    .description("Run build → deploy (if changed) → generate → smoke regression recipe")
    .requiredOption("-s, --source <source>", "Stellar CLI identity alias for deploy and smoke")
    .option("-n, --network <network>", "Configured network name")
    .option("--skip-test", "Skip pnpm test before build")
    .option("--skip-build", "Skip caatinga build")
    .option("--skip-deploy", "Skip deploy step")
    .option("--skip-generate", "Skip bindings generation")
    .option("--skip-smoke", "Skip smoke reads")
    .action(
      (options: {
        source: string;
        network?: string;
        skipTest?: boolean;
        skipBuild?: boolean;
        skipDeploy?: boolean;
        skipGenerate?: boolean;
        skipSmoke?: boolean;
      }) =>
        runCliAction(async () => {
          const config = await loadConfig();
          const network = resolveNetwork(config, options.network);

          if (!options.skipTest) {
            logger.info("Running tests...");
            await execa("pnpm", ["test"], { stdio: "inherit" });
          }

          if (!options.skipBuild) {
            logger.info("Building contracts...");
            if (config.buildRoot) {
              await buildWorkspace({ config });
            } else {
              const { buildContract } = await import("@caatinga/core");
              for (const contractName of Object.keys(config.contracts)) {
                await buildContract({ config, contractName });
              }
            }
          }

          if (!options.skipDeploy) {
            logger.info(`Deploying on ${network.name} (--if-changed)...`);
            const deployResult = await deployContractGraph({
              config,
              networkName: network.name,
              source: options.source,
              includeDependencies: true,
              force: false,
              ifChanged: true,
            });

            for (const deployed of deployResult.deployedContracts) {
              logger.info(`  ✓ ${deployed.name} → ${deployed.contractId}`);
            }
            for (const skipped of deployResult.skippedContracts) {
              logger.info(`  — ${skipped.name} unchanged (${skipped.contractId})`);
            }
          }

          if (!options.skipGenerate) {
            logger.info("Generating bindings...");
            await generateBindingsGraph({ config, networkName: network.name });
          }

          if (!options.skipSmoke) {
            logger.info("Running smoke reads...");
            const smoke = await runSmokeReads({
              config,
              networkName: network.name,
              source: options.source,
            });
            const failed = smoke.filter((entry) => !entry.passed);
            if (failed.length > 0) {
              process.exitCode = 1;
              throw new Error(
                `Smoke failed for ${failed.map((f) => `${f.contract}.${f.method}`).join(", ")}`
              );
            }
          }

          logger.success("Regression recipe complete");
        })
    );
}
