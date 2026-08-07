import { Command } from "commander";
import {
  deployContractGraph,
  estimateDeployCost,
  generateBindingsGraph,
  runPostDeployHooks,
  syncFrontendEnv,
  toCaatingaError,
  CaatingaError,
  CaatingaErrorCode,
  loadConfig,
  resolveNetwork,
} from "@caatinga/core";
import { npxCli } from "../utils/cli-name.js";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import {
  assertZkVerifierDeployAllowed,
  resolveContractNamesForDeploy,
} from "../utils/zk-guardrails.js";

export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description("Deploy one or all configured Soroban contracts")
    .argument("[contract]", "Contract name")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption(
      "-s, --source <source>",
      "Stellar CLI identity alias that can sign (for example alice)"
    )
    .option("--force", "Redeploy contracts even if artifacts already contain contract IDs")
    .option(
      "--if-changed",
      "Skip deploy when local WASM hash matches artifacts (redeploy when changed)"
    )
    .option("--upgrade", "Redeploy with upgrade history (alias for --force with upgrade reason)")
    .option("--dry-run", "Estimate deploy cost without submitting (runs ctg estimate deploy)")
    .option("--no-deps", "Do not deploy missing dependencies for a selected contract")
    .option("--no-stale-check", "Do not warn when WASM may be older than contract sources")
    .option("--verify-deps", "Verify dependency contract IDs exist on-chain before deploy")
    .option("--no-generate", "Skip TypeScript bindings generation after deploy")
    .option("--no-wire", "Skip configured post-deploy wiring hooks after a full deploy")
    .option("--no-sync-env", "Skip frontend env sync after a full deploy")
    .option(
      "--allow-dev-ceremony",
      "Allow deploying ZK verifier contracts with dev-ceremony artifacts on mainnet (not for production)"
    )
    .action(
      (
        contractName: string | undefined,
        options: {
          network?: string;
          source: string;
          force?: boolean;
          ifChanged?: boolean;
          upgrade?: boolean;
          dryRun?: boolean;
          deps?: boolean;
          staleCheck?: boolean;
          verifyDeps?: boolean;
          generate?: boolean;
          wire?: boolean;
          syncEnv?: boolean;
          allowDevCeremony?: boolean;
        }
      ) =>
        runCliAction(async () => {
          if (options.deps === false && !contractName) {
            throw new CaatingaError(
              "`--no-deps` requires a contract name.",
              CaatingaErrorCode.INVALID_CONFIG,
              "Select a single contract or omit `--no-deps` to deploy the full graph."
            );
          }

          const config = await loadConfig();
          const { name: networkName } = resolveNetwork(config, options.network);

          if (options.dryRun) {
            const target = contractName ?? Object.keys(config.contracts)[0];
            if (!target) {
              throw new CaatingaError(
                "No contract configured for deploy estimate.",
                CaatingaErrorCode.INVALID_CONFIG,
                "Add a contract to caatinga.config.ts or pass a contract name."
              );
            }

            const estimate = await estimateDeployCost({
              config,
              contractName: target,
              networkName: options.network,
              source: options.source,
            });

            logger.info(`Deploy estimate: ${estimate.contractName} (${estimate.network})`);
            logger.info(`Total (estimate): ${estimate.totalFeeStroops} stroops`);
            logger.warn(estimate.advisory);
            return;
          }

          const contractNames = resolveContractNamesForDeploy(config, contractName);

          await assertZkVerifierDeployAllowed({
            config,
            contractNames,
            networkName,
            allowDevCeremony: Boolean(options.allowDevCeremony),
          });

          const force = options.force === true || options.upgrade === true;

          const result = await deployContractGraph({
            config,
            contractName,
            networkName: options.network,
            source: options.source,
            includeDependencies: options.deps !== false,
            force,
            ifChanged: options.ifChanged === true,
            upgrade: options.upgrade === true,
            checkStaleWasm: options.staleCheck !== false,
            verifyDeps: options.verifyDeps === true,
            onTransientDeployRetry: ({ attempt, maxAttempts, delayMs }) => {
              logger.warn(
                `Deploy hit a transient testnet error (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delayMs / 1000)}s...`
              );
            },
          });

          for (const warning of result.staleWasmWarnings) {
            logger.warn(warning.message);
          }

          logger.success("Deploy complete");
          logger.info("");
          logger.info(`Network: ${result.network.name}`);
          for (const skipped of result.skippedContracts) {
            logger.info(`[skipped] ${skipped.name} — already deployed on ${result.network.name}`);
            logger.info(`  Contract ID: ${skipped.contractId}`);
          }
          for (const contract of result.deployedContracts) {
            logger.info(`[deployed] ${contract.name}`);
            logger.info(`  Contract ID: ${contract.contractId}`);
          }
          logger.info("Artifacts updated: caatinga.artifacts.json");

          const isFullDeploy = !contractName;

          if (
            isFullDeploy &&
            options.wire !== false &&
            config.postDeploy &&
            (config.postDeploy.length > 0 || (config.postDeployRead?.length ?? 0) > 0)
          ) {
            try {
              const wireResults = await runPostDeployHooks({
                config,
                networkName: options.network,
                source: options.source,
                onTransientHookRetry: ({ hook, attempt, maxAttempts, delayMs }) => {
                  logger.warn(
                    `Post-deploy hook ${hook.contract}.${hook.method} hit a transient post-deploy error (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delayMs / 1000)}s...`
                  );
                },
              });
              logger.info("");
              logger.success("Wire complete");
              for (const hook of wireResults) {
                logger.info(`  ${hook.contract}.${hook.method}`);
              }
            } catch (error) {
              const caatingaError = toCaatingaError(error);
              logger.warn("Deploy succeeded, but post-deploy wiring failed.");
              logger.warn(`  ${caatingaError.message} (${caatingaError.code})`);
              if (caatingaError.hint) {
                logger.warn(`  Hint: ${caatingaError.hint}`);
              }
              logger.info("");
              logger.info("Recover with:");
              logger.info(
                `  ${npxCli(`wire --network ${result.network.name} --source ${options.source}`)}`
              );
            }
          }

          if (
            isFullDeploy &&
            options.syncEnv !== false &&
            config.frontend?.envFile &&
            config.frontend.env
          ) {
            try {
              const envResult = await syncFrontendEnv({
                config,
                networkName: options.network,
              });
              logger.info("");
              logger.success(`Frontend env written: ${envResult.envFile}`);
            } catch (error) {
              const caatingaError = toCaatingaError(error);
              logger.warn("Deploy succeeded, but frontend env sync failed.");
              logger.warn(`  ${caatingaError.message} (${caatingaError.code})`);
              logger.info("");
              logger.info("Recover with:");
              logger.info(`  ${npxCli(`sync-env --network ${result.network.name}`)}`);
            }
          }

          if (result.deployedContracts.length === 0) {
            return;
          }

          if (options.generate === false) {
            logger.info("");
            logger.info("Bindings generation skipped (--no-generate).");
            logger.info("Next:");
            for (const contract of result.deployedContracts) {
              logger.info(
                `  ${npxCli(`generate ${contract.name} --network ${result.network.name}`)}`
              );
            }
            logger.info("  npm run dev");
            return;
          }

          if (!config.frontend) {
            logger.info("");
            logger.info("Bindings skipped (no frontend configured).");
            return;
          }

          // Generation failure must not flip the exit code: the deploy itself succeeded
          // and the artifacts are already written — the user only needs to rerun generate.
          try {
            const generated = await generateBindingsGraph({
              config,
              contractNames: result.deployedContracts.map((contract) => contract.name),
              networkName: result.network.name,
            });

            logger.info("");
            logger.success("Bindings generated");
            for (const binding of generated.results) {
              logger.info(`  ${binding.contractName} → ${binding.importPath}`);
            }
            logger.info("");
            logger.info("Next:");
            logger.info("  npm run dev");
          } catch (error) {
            const caatingaError = toCaatingaError(error);
            logger.info("");
            logger.warn("Deploy succeeded, but bindings generation failed.");
            logger.warn(`  ${caatingaError.message} (${caatingaError.code})`);
            if (caatingaError.hint) {
              logger.warn(`  Hint: ${caatingaError.hint}`);
            }
            logger.info("");
            logger.info("Recover with:");
            logger.info(`  ${npxCli(`generate --network ${result.network.name}`)}`);
          }
        })
    );
}
