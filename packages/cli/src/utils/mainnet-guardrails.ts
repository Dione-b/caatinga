import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import type { NetworkConfig } from "@caatinga/core";
import { CaatingaError, CaatingaErrorCode, requiresMainnetConfirmation } from "@caatinga/core";
import { logger } from "./logger.js";

/**
 * Fields that identify what is about to be signed. `contractId` and
 * `deployedWasmHash` describe the deployment being replaced or called, so they
 * come from the artifacts file rather than from the local build — the hash of
 * the WASM that will be uploaded is not known until the build/upload step runs.
 */
export type MainnetTargetDetails = {
  contractId?: string;
  deployedWasmHash?: string;
};

export type MainnetOperationDetails = MainnetTargetDetails & {
  operation: "deploy" | "upgrade" | "wire" | "invoke" | "rollback";
  networkName: string;
  networkConfig: NetworkConfig;
  source?: string;
  contractName?: string;
  target?: string;
  yes?: boolean;
  /**
   * Resolved only when the prompt is actually about to be shown, so reading
   * artifacts costs nothing on non-mainnet networks or under --yes. Failures
   * are swallowed: a missing artifact must not block the operation, it just
   * leaves those lines off the banner.
   */
  resolveTargetDetails?: () => Promise<MainnetTargetDetails>;
};

export function isAssumeYesSet(): boolean {
  const envVal = process.env.CAATINGA_ASSUME_YES?.toLowerCase().trim();
  return envVal === "true" || envVal === "1" || envVal === "yes" || envVal === "y";
}

export async function confirmMainnetOperation(details: MainnetOperationDetails): Promise<void> {
  const { networkName, networkConfig, operation, yes } = details;

  if (!requiresMainnetConfirmation(networkName, networkConfig)) {
    return;
  }

  if (yes || isAssumeYesSet()) {
    logger.warn(
      `[MAINNET GUARDRAIL] Mainnet operation "${operation.toUpperCase()}" automatically confirmed via --yes or CAATINGA_ASSUME_YES.`
    );
    return;
  }

  const isInteractive = Boolean(input.isTTY && output.isTTY);

  if (!isInteractive) {
    throw new CaatingaError(
      `Mainnet operation "${operation.toUpperCase()}" requires interactive confirmation.`,
      CaatingaErrorCode.MAINNET_CONFIRMATION_REQUIRED,
      "Pass --yes or set environment variable CAATINGA_ASSUME_YES=true to confirm unattended mainnet transactions in CI/non-interactive environments."
    );
  }

  let resolved: MainnetTargetDetails = {
    contractId: details.contractId,
    deployedWasmHash: details.deployedWasmHash,
  };

  if (details.resolveTargetDetails) {
    try {
      const extra = await details.resolveTargetDetails();
      resolved = {
        contractId: resolved.contractId ?? extra.contractId,
        deployedWasmHash: resolved.deployedWasmHash ?? extra.deployedWasmHash,
      };
    } catch {
      // Best effort only — the banner degrades, the guardrail still fires.
    }
  }

  logger.info("");
  logger.info(chalk.bgRed.white.bold(" ⚠️  WARNING: MAINNET TRANSACTION "));
  logger.info(chalk.red(`You are about to execute an irreversible signed mainnet operation.`));
  logger.info(`  Operation:   ${chalk.yellow(operation.toUpperCase())}`);
  logger.info(`  Network:     ${chalk.yellow(networkName)} (${networkConfig.rpcUrl})`);

  if (details.contractName) {
    logger.info(`  Contract:    ${details.contractName}`);
  }
  if (details.target) {
    logger.info(`  Target:      ${details.target}`);
  }
  if (resolved.contractId) {
    logger.info(`  Contract ID: ${chalk.yellow(resolved.contractId)}`);
  }
  if (resolved.deployedWasmHash) {
    const suffix = operation === "upgrade" ? " (will be replaced)" : "";
    logger.info(`  Deployed WASM: ${resolved.deployedWasmHash}${suffix}`);
  }
  if (details.source) {
    logger.info(`  Source Acc:  ${details.source}`);
  }
  logger.info("");

  const rl = readline.createInterface({ input, output });
  let answer = "";
  try {
    answer = await rl.question(
      chalk.yellow.bold(`Are you sure you want to proceed with this MAINNET transaction? [y/N]: `)
    );
  } finally {
    rl.close();
  }

  const confirmed = /^(y|yes)$/i.test(answer.trim());
  if (!confirmed) {
    throw new CaatingaError(
      `Mainnet operation "${operation.toUpperCase()}" cancelled by user.`,
      CaatingaErrorCode.MAINNET_CONFIRMATION_REQUIRED,
      "Operation aborted. No transaction was signed or submitted to mainnet."
    );
  }
}
