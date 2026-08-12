import { Command } from "commander";
import {
  collectProjectStatus,
  frontendBindingsConfigHint,
  loadConfig,
  type ContractStatusEntry,
} from "@caatinga/core";
import { npxCli } from "../utils/cli-name.js";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { renderTable } from "../utils/table.js";

function shortId(value: string | undefined): string {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 5)}…${value.slice(-4)}` : value;
}

function shortHash(value: string | undefined): string {
  if (!value) return "—";
  return value.slice(0, 8);
}

function toRow(entry: ContractStatusEntry): string[] {
  return [
    entry.name,
    shortId(entry.contractId),
    shortHash(entry.wasmHash),
    entry.deployed ? "✓" : "✗",
    entry.bindings.status,
    entry.dependencies.length > 0 ? entry.dependencies.join(", ") : "—",
  ];
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show deployed contracts and binding freshness per network")
    .option("-n, --network <network>", "Configured network name")
    .option("--json", "Print machine-readable JSON instead of the table")
    .option("--strict", "Exit with code 1 when any deployed contract has stale or missing bindings")
    .action((options: { network?: string; json?: boolean; strict?: boolean }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const status = await collectProjectStatus({
          config,
          networkName: options.network,
        });

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          logger.success(`Project: ${status.project}`);

          for (const network of status.networks) {
            logger.info("");
            logger.info(`Network: ${network.network}`);

            const lines = renderTable(
              ["CONTRACT", "CONTRACT ID", "WASM HASH", "DEPLOYED", "BINDINGS", "DEPS"],
              network.contracts.map(toRow)
            );
            for (const line of lines) {
              logger.info(line);
            }

            const needsAttention = network.contracts.filter(
              (entry) => entry.deployed && entry.bindings.status !== "fresh"
            );
            for (const entry of needsAttention) {
              const summary =
                `Bindings ${entry.bindings.status} for ${entry.name}` +
                `${entry.bindings.reason ? ` (${entry.bindings.reason})` : ""}`;

              // `generate` cannot run without frontend.bindingsOutput, so recommending it
              // here would send the user to a guaranteed CAATINGA_INVALID_CONFIG.
              if (entry.bindings.frontendUnconfigured) {
                logger.warn(summary);
                for (const hintLine of frontendBindingsConfigHint().split("\n")) {
                  logger.warn(hintLine ? `  ${hintLine}` : "");
                }
                continue;
              }

              logger.warn(
                `${summary} — run: ${npxCli(`generate ${entry.name} --network ${network.network}`)}`
              );
            }
          }
        }

        if (options.strict) {
          const stale = status.networks.some((network) =>
            network.contracts.some((entry) => entry.deployed && entry.bindings.status !== "fresh")
          );
          if (stale) {
            process.exitCode = 1;
          }
        }
      })
    );
}
