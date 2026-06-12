import { Command } from "commander";
import { collectProjectStatus, loadConfig, type ContractStatusEntry } from "@caatinga/core";
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
    entry.dependencies.length > 0 ? entry.dependencies.join(", ") : "—"
  ];
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show deployed contracts and binding freshness per network")
    .option("-n, --network <network>", "Configured network name")
    .option("--json", "Print machine-readable JSON instead of the table")
    .action((options: { network?: string; json?: boolean }) => runCliAction(async () => {
      const config = await loadConfig();
      const status = await collectProjectStatus({
        config,
        networkName: options.network
      });

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

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
          logger.warn(
            `Bindings ${entry.bindings.status} for ${entry.name}` +
              `${entry.bindings.reason ? ` (${entry.bindings.reason})` : ""}` +
              ` — run: npx caatinga generate ${entry.name} --network ${network.network}`
          );
        }
      }
    }));
}
