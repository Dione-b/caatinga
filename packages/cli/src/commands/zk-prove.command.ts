import { type Command } from "commander";
import path from "node:path";
import { loadConfig } from "@caatinga/core";
import { proveCircuit } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createZkInstallProgress } from "../utils/zk-install-progress.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkProveCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("prove [circuitName]")
    .description("Generate a Groth16 proof from input.json")
    .option("--debug", "Emit witness.wtns for inspection")
    .action(async (circuitName: string | undefined, options: { debug?: boolean }) => {
      await runCliAction(async () => {
        const config = await loadConfig();
        const zk = config.zk;
        if (!zk) {
          throw new Error("No ZK circuits configured");
        }

        const name = circuitName ?? Object.keys(zk.circuits)[0]!;
        const circuit = zk.circuits[name];
        if (!circuit) {
          throw new Error(`Circuit "${name}" not found`);
        }

        const artifactsDir = `.artifacts/zk/${name}`;
        await proveCircuit({
          circuitName: name,
          circuitPath: circuit.path,
          artifactsDir,
          inputPath: path.join(circuit.path, "input.json"),
          debug: Boolean(options.debug),
          progress: createZkInstallProgress(),
        });
        logger.success(`Generated proof for circuit "${name}"`);
        logger.info(`Proof written to: ${path.join(artifactsDir, "proof.json")}`);
      });
    });
}
