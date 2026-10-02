import { Command } from "commander";
import { formatNetworkOrigin, inspectContract, loadConfig, resolveNetwork } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect")
    .description("Inspect deployed contract state vs local artifacts")
    .argument("<contract>", "Contract name")
    .option("-n, --network <network>", "Configured network name")
    .action((contractName: string, options: { network?: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const network = resolveNetwork(config, options.network);

        logger.info(`Network: ${formatNetworkOrigin(network)}`);

        const result = await inspectContract({
          config,
          contractName,
          networkName: options.network,
        });

        logger.info(`Inspect: ${result.contractName}`);
        logger.info(`Contract ID: ${result.artifact.contractId}`);
        logger.info(`Artifact WASM hash: ${result.artifact.wasmHash}`);
        logger.info(`Deployed at: ${result.artifact.deployedAt}`);
        logger.info(`History entries: ${result.artifact.historyCount}`);
        logger.info(
          `On-chain: ${result.onChain.reachable ? "reachable" : "not reachable"}${
            result.onChain.detail ? ` — ${result.onChain.detail}` : ""
          }`
        );
        logger.info(
          `Local WASM: ${result.localWasm.matchesArtifact ? "matches artifact" : "differs or missing"}`
        );
        if (result.localWasm.hash) {
          logger.info(`  Local hash: ${result.localWasm.hash}`);
        }
        if (result.dependencies.length > 0) {
          logger.info(`Dependencies: ${result.dependencies.join(", ")}`);
        }
      })
    );
}
