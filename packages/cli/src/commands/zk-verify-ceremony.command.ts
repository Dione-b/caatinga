import { type Command } from "commander";
import { loadConfig } from "@caatinga/core";
import { verifyCeremony } from "@caatinga/zk";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createZkInstallProgress } from "../utils/zk-install-progress.js";
import { resolveZkCircuit } from "../utils/zk-circuit.js";
import { getOrCreateZkCommand } from "./zk.command.js";

export function registerZkVerifyCeremonyCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("verify-ceremony [circuitName]")
    .description(
      "Re-check an imported MPC ceremony offline: artifact hashes, snarkjs zkey verify, and the verification key"
    )
    .action(async (circuitName: string | undefined) => {
      await runCliAction(async () => {
        const config = await loadConfig();
        const { name, artifactsDir } = resolveZkCircuit(config, circuitName);

        logger.info(`Verifying imported ceremony for circuit "${name}"...`);
        const result = await verifyCeremony({
          artifactsDir,
          progress: createZkInstallProgress(),
        });

        logger.success("Artifact hashes match ceremony.json");
        if (result.zkey === "verified") {
          logger.success(
            "snarkjs zkey verify: proving key derives from the circuit and powers-of-tau"
          );
        } else {
          logger.warn(
            "snarkjs zkey verify skipped: the ceremony was imported without a .ptau file. Re-import it with the ceremony's final powers-of-tau to verify the proving key."
          );
        }
        logger.success("verification_key.json matches the key exported from the zkey");

        for (const mismatch of result.mismatches) {
          logger.warn(
            `${mismatch.path} changed since import (recompiled by \`ctg zk build\`?); it is recorded for audit only.`
          );
        }

        const provenance = result.manifest.provenance;
        if (provenance) {
          logger.info("");
          logger.info("Provenance (as recorded at import, not independently checked):");
          if (provenance.ceremony) logger.info(`  Ceremony:     ${provenance.ceremony}`);
          if (provenance.sourceUrl) logger.info(`  Source:       ${provenance.sourceUrl}`);
          if (provenance.participants !== undefined)
            logger.info(`  Participants: ${provenance.participants}`);
          logger.info(`  Retrieved:    ${provenance.retrievedAt}`);
        }
      });
    });
}
