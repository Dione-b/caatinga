import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import type { NetworkConfig } from "@caatinga/core";
import { CaatingaError, CaatingaErrorCode, requiresMainnetConfirmation } from "@caatinga/core";
import { logger } from "./logger.js";

export type MainnetOperationDetails = {
  operation: "deploy" | "upgrade" | "wire" | "invoke" | "rollback";
  networkName: string;
  networkConfig: NetworkConfig;
  source?: string;
  contractName?: string;
  contractId?: string;
  wasmHash?: string;
  target?: string;
  method?: string;
  yes?: boolean;
};

export function isAssumeYesSet(): boolean {
  const envVal = process.env.CAATINGA_ASSUME_YES?.toLowerCase().trim();
  return envVal === "true" || envVal === "1" || envVal === "yes" || envVal === "y";
}

export async function confirmMainnetOperation(
  details: MainnetOperationDetails
): Promise<void> {
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
  if (details.contractId) {
    logger.info(`  Contract ID: ${details.contractId}`);
  }
  if (details.wasmHash) {
    logger.info(`  WASM Hash:   ${details.wasmHash}`);
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
