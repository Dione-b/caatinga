import { Command } from "commander";
import {
  assertProtocolForZk,
  estimateDeployCost,
  estimateZkVerifyCost,
  formatNetworkOrigin,
  formatZkVerifyCostEstimate,
  loadConfig,
  resolveNetwork,
} from "@caatinga/core";
import { readVerificationKeyPublicSignals, zkArtifactsDir } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerEstimateCommand(program: Command): void {
  const estimate = program
    .command("estimate")
    .description("Estimate fees before submitting transactions");

  estimate
    .command("deploy")
    .description("Estimate deploy fees for a contract (advisory)")
    .argument("<contract>", "Contract name")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption(
      "-s, --source <source>",
      "Stellar CLI identity alias used to build the deploy transaction"
    )
    .action((contractName: string, options: { network?: string; source: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const network = resolveNetwork(config, options.network);

        logger.info(`Network: ${formatNetworkOrigin(network)}`);

        const result = await estimateDeployCost({
          config,
          contractName,
          networkName: options.network,
          source: options.source,
        });

        logger.info(`Deploy estimate: ${result.contractName}`);
        logger.info(`WASM: ${result.wasmPath}`);
        if (!result.simulation.ok) {
          logger.warn(`Fee estimate unavailable: ${result.simulation.error}`);
          logger.warn(result.advisory);
          return;
        }
        logger.info(`Inclusion fee: ${result.inclusionFeeStroops} stroops`);
        if (result.resourceFeeStroops !== undefined) {
          logger.info(`Resource fee: ${result.resourceFeeStroops} stroops`);
        }
        logger.info(`Total (estimate): ${result.totalFeeStroops} stroops`);
        logger.warn(result.advisory);
      })
    );

  estimate
    .command("verify <circuit>")
    .description("Estimate the on-chain CPU and memory budget for verifying a ZK proof (advisory)")
    .option("-n, --network <network>", "Configured network name to check against")
    .action((circuitName: string, options: { network?: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const zk = config.zk;
        const circuit = zk?.circuits[circuitName];
        if (!circuit) {
          throw new Error(`Circuit "${circuitName}" not found in caatinga.config.ts`);
        }

        if (options.network) {
          const network = resolveNetwork(config, options.network);
          logger.info(`Network: ${formatNetworkOrigin(network)}`);

          // An estimate is only useful if the network can verify BLS12-381 at
          // all, so surface the protocol pre-flight alongside the budget.
          const advisory = await assertProtocolForZk({
            networkName: network.name,
            networkConfig: network.config,
            operation: `ctg estimate verify ${circuitName}`,
          });
          if (advisory) {
            logger.warn(advisory);
          }
        }

        const vkPath = `${zkArtifactsDir(circuitName)}/verification_key.json`;
        const publicSignals = await readVerificationKeyPublicSignals(vkPath);

        const estimateResult = estimateZkVerifyCost({ circuitName, publicSignals });
        for (const line of formatZkVerifyCostEstimate(estimateResult)) {
          logger.info(line);
        }

        for (const advisory of estimateResult.advisories) {
          logger.warn(advisory);
        }

        logger.info(`Verifier contract: ${circuit.verifierContract ?? "(not configured)"}`);
        logger.warn(
          "Estimates are fitted to testnet simulations of the Caatinga verifier and depend only on the public-signal count. Simulate the real call with `stellar contract invoke --send=no` (or scripts/zk-verify-benchmark.mjs) for exact numbers."
        );
      })
    );
}
