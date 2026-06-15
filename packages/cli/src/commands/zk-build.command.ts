import { type Command } from "commander";
import { loadConfig } from "@caatinga/core";
import { buildCircuit } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkBuildCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("build [circuitName]")
    .description("Compile a Circom circuit and run the trusted setup")
    .option("--embed-vk", "Emit a static vk.rs artifact for the verifier contract")
    .action(async (circuitName: string | undefined, options: { embedVk?: boolean }) => {
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

        logger.info(`Building circuit "${name}" with curve ${circuit.curve}...`);
        await buildCircuit({
          circuitName: name,
          circuitPath: circuit.path,
          artifactsDir: `.artifacts/zk/${name}`,
          embedVk: Boolean(options.embedVk),
        });
        logger.success(`Built circuit "${name}"`);
        logger.warn("This is a single-party development trusted setup. Do not use it in production.");
      });
    });
}
