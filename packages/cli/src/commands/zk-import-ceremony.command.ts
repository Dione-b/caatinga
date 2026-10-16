import { type Command } from "commander";
import { loadConfig } from "@caatinga/core";
import { importCeremony, zkArtifactsDir } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createZkInstallProgress } from "../utils/zk-install-progress.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkImportCeremonyCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("import-ceremony [circuitName]")
    .description("Replace dev ceremony artifacts with audited MPC ceremony artifacts")
    .requiredOption(
      "-c, --ceremony <path>",
      "Directory holding the ceremony output (circuit_final.zkey and verification_key.json)"
    )
    .action(async (circuitName: string | undefined, options: { ceremony: string }) => {
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

        const artifactsDir = zkArtifactsDir(name);
        logger.info(`Importing MPC ceremony artifacts for circuit "${name}"...`);
        logger.info(`From: ${options.ceremony}`);
        logger.info(`Into: ${artifactsDir}`);

        const result = await importCeremony({
          circuitName: name,
          circuitPath: circuit.path,
          artifactsDir,
          ceremonyDir: options.ceremony,
          progress: createZkInstallProgress(),
        });

        logger.success(`Imported MPC ceremony artifacts for circuit "${name}"`);
        logger.info(`Public signals: ${result.publicSignals}`);
        logger.info(`Proving key: ${result.zkeyPath}`);
        if (result.ptauPath) {
          logger.info(`Powers of tau: ${result.ptauPath}`);
        }
        logger.info("");
        logger.info(
          "The dev-ceremony mainnet guardrail no longer applies to this circuit. Deploy and invoke on mainnet are now allowed with these artifacts."
        );
        logger.warn(
          "Audit the ceremony before deploying for real: these artifacts replace the local dev ceremony, and Caatinga only checks circuit compatibility, not the ceremony's trustworthiness."
        );
      });
    });
}
