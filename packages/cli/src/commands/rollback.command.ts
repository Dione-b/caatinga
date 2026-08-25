import { Command } from "commander";
import {
  CaatingaError,
  CaatingaErrorCode,
  loadConfig,
  resolveNetwork,
  rollbackContractArtifact,
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { confirmMainnetOperation } from "../utils/mainnet-guardrails.js";

/** Stellar contract IDs are base-32 encoded 56-char strings starting with C, or hex 64-char strings. */
const VALID_CONTRACT_ID = /^(C[A-Z2-7]{55}|[0-9a-fA-F]{64})$/;

export function registerRollbackCommand(program: Command): void {
  program
    .command("rollback")
    .description("Restore a prior contract ID in caatinga.artifacts.json (logical rollback)")
    .argument("<contract>", "Contract name")
    .requiredOption("--to <contractId>", "Historical contract ID to restore")
    .option("-n, --network <network>", "Configured network name")
    .option("-y, --yes", "Automatically confirm mainnet transactions without interactive prompt")
    .action((contractName: string, options: { to: string; network?: string; yes?: boolean }) =>
      runCliAction(async () => {
        if (!VALID_CONTRACT_ID.test(options.to)) {
          throw new CaatingaError(
            `Invalid contract ID format: ${options.to}`,
            CaatingaErrorCode.INVALID_CONFIG,
            "Contract ID must be a base-32 encoded string (C..., 56 chars) or hex-encoded string (64 chars)."
          );
        }

        const config = await loadConfig();
        const { name: networkName, config: networkConfig } = resolveNetwork(config, options.network);

        await confirmMainnetOperation({
          operation: "rollback",
          networkName,
          networkConfig,
          contractName,
          contractId: options.to,
          yes: options.yes,
        });

        const result = await rollbackContractArtifact({
          networkName,
          contractName,
          contractId: options.to,
        });

        logger.success("Artifact rollback complete");
        logger.info(`Network: ${networkName}`);
        logger.info(`Contract: ${contractName}`);
        logger.info(`Active contract ID: ${options.to}`);
        logger.info(`Updated: ${result.path}`);
        logger.warn(
          "On-chain state unchanged — previous deployments may remain as orphaned contracts."
        );
      })
    );
}
