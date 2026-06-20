import { type Command } from "commander";
import { loadConfig } from "@caatinga/core";
import { invokeVerifier } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkInvokeCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("invoke [circuitName]")
    .description("Serialize the proof and invoke the verifier contract")
    .option("--embed-vk", "Use the embedded VK path (no VK argument)")
    .requiredOption(
      "-s, --source <identity>",
      "Stellar CLI identity alias that can sign (for example alice)"
    )
    .action(
      async (circuitName: string | undefined, options: { embedVk?: boolean; source: string }) => {
        await runCliAction(async () => {
          const config = await loadConfig();
          const zk = config.zk;
          if (!zk) {
            throw new Error("No ZK circuits configured");
          }

          const name = circuitName ?? Object.keys(zk.circuits)[0]!;
          const circuit = zk.circuits[name];
          if (!circuit?.verifierContract) {
            throw new Error(`Verifier contract not configured for circuit "${name}"`);
          }

          const result = await invokeVerifier({
            verifierContract: circuit.verifierContract,
            network: config.defaultNetwork,
            sourceAccount: options.source,
            proofPath: `.artifacts/zk/${name}/proof.json`,
            vkPath: `.artifacts/zk/${name}/verification_key.json`,
            publicSignalsPath: `.artifacts/zk/${name}/public.json`,
            embedVk: Boolean(options.embedVk),
            config,
          });

          logger.success(`Proof verified for circuit "${name}"`);
          logger.info("");
          logger.info(`Network: ${result.network}`);
          logger.info(`Contract: ${result.verifierContract}`);
          logger.info(`Contract ID: ${result.contractId}`);
          logger.info(`Public signals: ${JSON.stringify(result.publicSignals)}`);
          logger.info(`Result: ${result.verified}`);
        });
      }
    );
}
