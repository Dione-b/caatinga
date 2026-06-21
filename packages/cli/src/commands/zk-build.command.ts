import { type Command } from "commander";
import { loadConfig } from "@caatinga/core";
import { buildCircuit } from "@caatinga/zk";
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
      "--allow-dev-ceremony",
      "Allow single-party dev ceremony when defaultNetwork is mainnet (not for production)"
    )
    .action(
      async (
        circuitName: string | undefined,
        options: { embedVk?: boolean; allowDevCeremony?: boolean }
      ) => {
        await runCliAction(async () => {
          const config = await loadConfig();
          const zk = config.zk;
          if (!zk || Object.keys(zk.circuits).length === 0) {
            throw new Error("No ZK circuits configured in caatinga.config.ts");
          }

          await assertZkBuildNetworkAllowed({
            networkName: config.defaultNetwork,
            allowDevCeremony: Boolean(options.allowDevCeremony),
          });

          const name = circuitName ?? Object.keys(zk.circuits)[0]!;
          const circuit = zk.circuits[name];
          if (!circuit) {
            throw new Error(`Circuit "${name}" not found in caatinga.config.ts`);
          }

          if (options.embedVk) {
            logger.warn(
              "`--embed-vk` is experimental: it writes vk.rs but the default verifier scaffold and `zk invoke --embed-vk` are not end-to-end yet."
            );
            logger.warn("See docs/zk.md — use the dynamic VK flow for verification today.");
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
          logger.warn(
            `Single-party development trusted setup (defaultNetwork: ${config.defaultNetwork}). Do not use on mainnet for production.`
          );
        });
      }
    );
}
