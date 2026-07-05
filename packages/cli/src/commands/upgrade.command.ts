import { Command } from "commander";
import {
  generateBindingsGraph,
  loadConfig,
  resolveNetwork,
  syncFrontendEnv,
  toCaatingaError,
  upgradeContractInPlace,
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade")
    .description(
      "Upgrade a deployed contract in-place (upload WASM and invoke upgrade on the existing contract ID)"
    )
    .argument("<contract>", "Contract name")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption(
      "-s, --source <source>",
      "Stellar CLI identity alias that can sign as contract admin (for example deployer)"
    )
    .option(
      "--if-changed",
      "Skip upgrade when local WASM hash matches the artifact (upgrade when changed)"
    )
    .option(
      "--expected-hash <hash>",
      "Fail before upload when local WASM hash does not match this value"
    )
    .option("--no-build", "Skip caatinga build before upload")
    .option("--generate", "Regenerate TypeScript bindings after upgrade")
    .option("--sync-env", "Sync frontend env file after upgrade")
    .action(
      (
        contractName: string,
        options: {
          network?: string;
          source: string;
          ifChanged?: boolean;
          expectedHash?: string;
          build?: boolean;
          generate?: boolean;
          syncEnv?: boolean;
        }
      ) =>
        runCliAction(async () => {
          const config = await loadConfig();
          const { name: networkName } = resolveNetwork(config, options.network);

          const result = await upgradeContractInPlace({
            config,
            contractName,
            networkName: options.network,
            source: options.source,
            ifChanged: options.ifChanged === true,
            expectedHash: options.expectedHash,
            build: options.build,
            onTransientUpgradeRetry: ({ attempt, maxAttempts, delayMs }) => {
              logger.warn(
                `Upgrade hit a transient error (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delayMs / 1000)}s...`
              );
            },
          });

          if (result.skipped) {
            logger.info(`[skipped] ${result.contractName} — WASM unchanged on ${networkName}`);
            logger.info(`  Contract ID: ${result.contractId}`);
            return;
          }

          logger.success("Upgrade complete");
          logger.info(`Network: ${networkName}`);
          logger.info(`Contract: ${result.contractName}`);
          logger.info(`Contract ID: ${result.contractId}`);
          logger.info(`WASM hash: ${result.wasmHash}`);
          logger.info(`Artifacts updated: ${result.artifactPath}`);

          if (options.syncEnv && config.frontend?.envFile && config.frontend.env) {
            try {
              const envResult = await syncFrontendEnv({
                config,
                networkName: options.network,
              });
              logger.info("");
              logger.success(`Frontend env written: ${envResult.envFile}`);
            } catch (error) {
              const caatingaError = toCaatingaError(error);
              logger.warn("Upgrade succeeded, but frontend env sync failed.");
              logger.warn(`  ${caatingaError.message} (${caatingaError.code})`);
              logger.info("");
              logger.info("Recover with:");
              logger.info(`  npx caatinga sync-env --network ${networkName}`);
            }
          }

          if (options.generate) {
            if (!config.frontend) {
              logger.info("");
              logger.info("Bindings skipped (no frontend configured).");
              return;
            }

            try {
              const generated = await generateBindingsGraph({
                config,
                contractNames: [result.contractName],
                networkName,
              });

              logger.info("");
              logger.success("Bindings generated");
              for (const binding of generated.results) {
                logger.info(`  ${binding.contractName} → ${binding.importPath}`);
              }
            } catch (error) {
              const caatingaError = toCaatingaError(error);
              logger.warn("Upgrade succeeded, but bindings generation failed.");
              logger.warn(`  ${caatingaError.message} (${caatingaError.code})`);
              logger.info("");
              logger.info("Recover with:");
              logger.info(
                `  npx caatinga generate ${result.contractName} --network ${networkName}`
              );
            }
          }
        })
    );
}
