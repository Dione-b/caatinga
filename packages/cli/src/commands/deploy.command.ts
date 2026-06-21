import { Command } from "commander";
import {
  deployContractGraph,
  generateBindingsGraph,
  toCaatingaError,
  CaatingaError,
  CaatingaErrorCode,
  loadConfig,
  resolveNetwork,
} from "@caatinga/core";
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
    .option("--no-deps", "Do not deploy missing dependencies for a selected contract")
    .option("--no-stale-check", "Do not warn when WASM may be older than contract sources")
    .option("--verify-deps", "Verify dependency contract IDs exist on-chain before deploy")
    .option("--no-generate", "Skip TypeScript bindings generation after deploy")
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
          deps?: boolean;
          staleCheck?: boolean;
          verifyDeps?: boolean;
          generate?: boolean;
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
          const contractNames = resolveContractNamesForDeploy(config, contractName);

          await assertZkVerifierDeployAllowed({
            config,
            contractNames,
            networkName,
            allowDevCeremony: Boolean(options.allowDevCeremony),
          });

          const result = await deployContractGraph({
            config,
            contractName,
            networkName: options.network,
            source: options.source,
            includeDependencies: options.deps !== false,
            force: options.force === true,
            checkStaleWasm: options.staleCheck !== false,
            verifyDeps: options.verifyDeps === true,
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

          if (result.deployedContracts.length === 0) {
            return;
          }

          if (options.generate === false) {
            logger.info("");
            logger.info("Bindings generation skipped (--no-generate).");
            logger.info("Next:");
            for (const contract of result.deployedContracts) {
              logger.info(
                `  npx caatinga generate ${contract.name} --network ${result.network.name}`
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
            logger.info(`  npx caatinga generate --network ${result.network.name}`);
          }
        })
    );
}
