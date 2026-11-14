import { type Command } from "commander";
import path from "node:path";
import { loadConfig } from "@caatinga/core";
import { CIRCUIT_INPUT_FILE, proveCircuit } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createZkInstallProgress } from "../utils/zk-install-progress.js";
import { resolveZkCircuit } from "../utils/zk-circuit.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkProveCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("prove [circuitName]")
    .description("Generate a Groth16 proof from input.json")
    .option("--debug", "Emit witness.wtns for inspection")
    .action(async (circuitName: string | undefined, options: { debug?: boolean }) => {
      await runCliAction(async () => {
        const config = await loadConfig();
        const { name, circuit, artifactsDir, artifacts } = resolveZkCircuit(config, circuitName);

        await proveCircuit({
          circuitName: name,
          circuitPath: circuit.path,
          artifactsDir,
          inputPath: path.join(circuit.path, CIRCUIT_INPUT_FILE),
          debug: Boolean(options.debug),
          progress: createZkInstallProgress(),
        });
        logger.success(`Generated proof for circuit "${name}"`);
        logger.info(`Proof written to: ${artifacts.proof}`);
      });
    });
}
