import { type Command } from "commander";
import { CaatingaError, CaatingaErrorCode, loadConfig } from "@caatinga/core";
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
    .option(
      "--source-url <url>",
      "Where the ceremony artifacts were published (recorded for audit)"
    )
    .option("--ceremony-name <name>", "Name of the ceremony (recorded for audit)")
    .option("--participants <count>", "Number of ceremony participants (recorded for audit)")
    .option(
      "--retrieved-at <iso-date>",
      "When the artifacts were retrieved from --source-url (defaults to now)"
    )
    .action(
      async (
        circuitName: string | undefined,
        options: {
          ceremony: string;
          sourceUrl?: string;
          ceremonyName?: string;
          participants?: string;
          retrievedAt?: string;
        }
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

          const artifactsDir = zkArtifactsDir(name);
          logger.info(`Importing MPC ceremony artifacts for circuit "${name}"...`);
          logger.info(`From: ${options.ceremony}`);
          logger.info(`Into: ${artifactsDir}`);

          const result = await importCeremony({
            circuitName: name,
            circuitPath: circuit.path,
            artifactsDir,
            ceremonyDir: options.ceremony,
            provenance: parseProvenance(options),
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
          logger.info(
            "Artifact hashes are pinned in ceremony.json; mainnet deploy/invoke refuse them if they change."
          );
          logger.info(
            `Run \`ctg zk verify-ceremony ${name}\` to check the proving key against the powers-of-tau offline.`
          );
          logger.warn(
            "Audit the ceremony before deploying for real: Caatinga checks circuit compatibility and artifact integrity, not the ceremony's trustworthiness."
          );
        });
      }
    );
}

function parseProvenance(options: {
  sourceUrl?: string;
  ceremonyName?: string;
  participants?: string;
  retrievedAt?: string;
}) {
  let participants: number | undefined;
  if (options.participants !== undefined) {
    participants = Number(options.participants);
    if (!Number.isInteger(participants) || participants < 1) {
      throw new CaatingaError(
        `--participants must be a positive integer, got "${options.participants}".`,
        CaatingaErrorCode.INVALID_CONFIG
      );
    }
  }

  if (options.retrievedAt !== undefined && Number.isNaN(Date.parse(options.retrievedAt))) {
    throw new CaatingaError(
      `--retrieved-at must be an ISO date, got "${options.retrievedAt}".`,
      CaatingaErrorCode.INVALID_CONFIG
    );
  }

  return {
    sourceUrl: options.sourceUrl,
    ceremony: options.ceremonyName,
    participants,
    retrievedAt:
      options.retrievedAt === undefined ? undefined : new Date(options.retrievedAt).toISOString(),
  };
}
