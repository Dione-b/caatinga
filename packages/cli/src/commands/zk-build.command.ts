import { type Command } from "commander";
import { formatNetworkOrigin, loadConfig, resolveNetwork } from "@caatinga/core";
import { buildCircuit, readCeremonyManifest } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createZkInstallProgress } from "../utils/zk-install-progress.js";
import { assertZkBuildNetworkAllowed } from "../utils/zk-guardrails.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkBuildCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("build [circuitName]")
    .description("Compile a Circom circuit and run the trusted setup")
    .option("--embed-vk", "Emit a static vk.rs artifact for the verifier contract (experimental)")
    .option(
      "-n, --network <network>",
      "Network the built artifacts are meant for (defaults to defaultNetwork)"
    )
    .option(
      "--allow-dev-ceremony",
      "Allow single-party dev ceremony when the target network is mainnet (not for production)"
    )
    .action(
      async (
        circuitName: string | undefined,
        options: { embedVk?: boolean; network?: string; allowDevCeremony?: boolean }
      ) => {
        await runCliAction(async () => {
          const config = await loadConfig();
          const zk = config.zk;
          if (!zk || Object.keys(zk.circuits).length === 0) {
            throw new Error("No ZK circuits configured in caatinga.config.ts");
          }

          const name = circuitName ?? Object.keys(zk.circuits)[0]!;
          const circuit = zk.circuits[name];
          if (!circuit) {
            throw new Error(`Circuit "${name}" not found in caatinga.config.ts`);
          }

          // The guard runs against the network the artifacts will be deployed to,
          // not just defaultNetwork: a testnet default must not let dev-ceremony
          // keys be built for a later `--network mainnet` deploy without warning.
          const network = resolveNetwork(config, options.network);
          logger.info(`Network: ${formatNetworkOrigin(network)}`);

          // The circuit is resolved before this call so the guardrail can look for
          // an existing MPC ceremony manifest and, when one is present, allow a
          // mainnet target: the build reuses rather than replaces it.
          await assertZkBuildNetworkAllowed({
            networkName: network.name,
            networkConfig: network.config,
            allowDevCeremony: Boolean(options.allowDevCeremony),
            artifactsDir: `.artifacts/zk/${name}`,
          });

          if (options.embedVk) {
            logger.warn(
              "`--embed-vk` writes contracts/verifier/src/vk.rs and enables the `verify_proof_embedded` entrypoint."
            );
            logger.warn(
              "Rebuild and redeploy the verifier with `ctg build verifier` and `ctg deploy verifier` before invoking with `ctg zk invoke <circuit> --embed-vk`."
            );
            logger.warn(
              "Prefer the dynamic VK flow (`verify_proof`) while the circuit is still changing; embedded VK suits a frozen circuit."
            );
          }

          logger.info(`Building circuit "${name}" with curve ${circuit.curve}...`);
          await buildCircuit({
            circuitName: name,
            circuitPath: circuit.path,
            artifactsDir: `.artifacts/zk/${name}`,
            embedVk: Boolean(options.embedVk),
            progress: createZkInstallProgress(),
          });
          logger.success(`Built circuit "${name}"`);

          // Only a dev ceremony earns this warning. Claiming one after a build
          // that reused imported MPC artifacts would be actively misleading.
          const ceremony = await readCeremonyManifest(`.artifacts/zk/${name}`);
          if (ceremony?.type === "dev-single-party") {
            logger.warn(
              `Single-party development trusted setup (network: ${network.name}). Do not use on mainnet for production.`
            );
          } else if (ceremony?.type === "mpc-multi-party") {
            logger.info("Using imported MPC ceremony artifacts — no dev ceremony was run.");
          }
        });
      }
    );
}
