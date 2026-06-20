import { Command } from "commander";
import {
  evaluateBindingsFreshness,
  generateBindingsGraph,
  loadConfig,
  readArtifacts,
  resolveNetwork,
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

async function printFreshnessPreState(
  config: Awaited<ReturnType<typeof loadConfig>>,
  networkName?: string
): Promise<void> {
  try {
    const network = resolveNetwork(config, networkName);
    const artifacts = await readArtifacts();
    const freshness = await evaluateBindingsFreshness({
      config,
      artifacts,
      networkName: network.name,
    });

    if (freshness.length === 0) {
      return;
    }

    logger.info("Current bindings:");
    for (const entry of freshness) {
      const reason = entry.reason ? ` — ${entry.reason}` : "";
      logger.info(`  [${entry.status}] ${entry.contractName}${reason}`);
    }
    logger.info("");
  } catch {
    // Pre-state is informational only; generation proceeds and reports real errors.
  }
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate TypeScript bindings for deployed contracts")
    .argument("[contract]", "Contract name (defaults to all deployed contracts)")
    .option("-n, --network <network>", "Configured network name")
    .action(
      (
        contractName: string | undefined,
        options: {
          network?: string;
        }
      ) =>
        runCliAction(async () => {
          const config = await loadConfig();

          if (!contractName) {
            await printFreshnessPreState(config, options.network);
          }

          const { network, results } = await generateBindingsGraph({
            config,
            contractName,
            networkName: options.network,
          });

          logger.success("Client generated");
          logger.info("");
          logger.info(`Network: ${network.name}`);
          for (const result of results) {
            logger.info("");
            logger.info(`Contract: ${result.contractName}`);
            logger.info(`Output: ${result.outputDir}`);
            logger.info(`Import path: ${result.importPath}`);
            if (result.legacyStubRemoved) {
              logger.info(
                `Removed legacy stub: ${config.frontend?.bindingsOutput}/${result.contractName}.ts`
              );
            }
          }
          logger.info("");
          logger.info("Next: import bindings from the import path above, then run npm run dev");
        })
    );
}
