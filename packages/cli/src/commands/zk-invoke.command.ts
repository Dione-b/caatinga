import { type Command } from "commander";
import { loadConfig, resolveNetwork } from "@caatinga/core";
import { assertDevCeremonyAllowed, invokeVerifier, zkArtifactsDir } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { confirmMainnetOperation } from "../utils/mainnet-guardrails.js";
import { getOrCreateZkCommand } from "./zk.command.js";
import { assertEmbedVkInvokeBlocked } from "../utils/zk-guardrails.js";

export function registerZkInvokeCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("invoke [circuitName]")
    .description("Serialize the proof and invoke the verifier contract")
    .option("--embed-vk", "Use the embedded VK path (experimental — not supported end-to-end yet)")
    .option("-n, --network <network>", "Configured network name (defaults to defaultNetwork)")
    .option("-y, --yes", "Automatically confirm mainnet transactions without interactive prompt")
    .option(
      "--allow-dev-ceremony",
      "Allow dev-ceremony ZK artifacts on mainnet (not for production)"
    )
    .requiredOption(
      "-s, --source <identity>",
      "Stellar CLI identity alias that can sign (for example alice)"
    )
    .action(
      async (
        circuitName: string | undefined,
        options: {
          embedVk?: boolean;
          network?: string;
          yes?: boolean;
          allowDevCeremony?: boolean;
          source: string;
        }
      ) => {
        await runCliAction(async () => {
          assertEmbedVkInvokeBlocked(Boolean(options.embedVk));

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

          const { name: networkName, config: networkConfig } = resolveNetwork(
            config,
            options.network
          );

          // Runs after the ceremony gate so a blocked dev-ceremony invoke still
          // reports CAATINGA_ZK_DEV_CEREMONY_BLOCKED rather than a confirmation error.
          await assertDevCeremonyAllowed({
            networkName,
            artifactsDir: zkArtifactsDir(name),
            allowDevCeremony: Boolean(options.allowDevCeremony),
            operation: `ctg zk invoke ${name}`,
          });

          await confirmMainnetOperation({
            operation: "invoke",
            networkName,
            networkConfig,
            contractName: name,
            contractId: circuit.verifierContract,
            source: options.source,
            yes: options.yes,
          });

          const result = await invokeVerifier({
            verifierContract: circuit.verifierContract,
            network: networkName,
            sourceAccount: options.source,
            proofPath: `${zkArtifactsDir(name)}/proof.json`,
            vkPath: `${zkArtifactsDir(name)}/verification_key.json`,
            publicSignalsPath: `${zkArtifactsDir(name)}/public.json`,
            embedVk: false,
            config,
          });

          logger.success(`Proof verified for circuit "${name}"`);
          logger.info("");
          logger.info(`Network: ${result.network}`);
          logger.info(`Verifier: ${result.verifierContract}`);
          logger.info(`Contract ID: ${result.contractId}`);
          logger.info(`Public signals: ${result.publicSignals.join(", ")}`);
        });
      }
    );
}
