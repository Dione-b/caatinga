import { Command } from "commander";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import { runAllDiagnostics } from "../diagnostics/run-all.js";
import { printDiagnostic, printFixes } from "../diagnostics/types.js";
import { evaluateDeployCoverage, type DeployCoverageLine } from "./doctor-deploy-coverage.js";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

type DoctorOptions = {
  network?: string;
  source?: string;
  allowUntestedStellarCli?: boolean;
};

function printDeployCoverageLine(line: DeployCoverageLine): void {
  if (line.ok) {
    logger.info(`✓ ${line.name} — ${line.contractId}`);
    return;
  }

  logger.info(`✗ ${line.name}`);
  if (line.fix) logger.info(`  ${line.fix}`);
}

export async function reportDeployCoverage(networkName: string): Promise<boolean> {
  const coverage = await evaluateDeployCoverage({ networkName });

  logger.info("");
  logger.info(`Deploy coverage (${networkName}):`);
  for (const line of coverage.lines) {
    printDeployCoverageLine(line);
  }

  if (!coverage.complete) {
    const missing = coverage.lines.filter((line) => !line.ok).map((line) => line.name);
    throw new CaatingaError(
      `Not all configured contracts are deployed on ${networkName}.`,
      CaatingaErrorCode.DOCTOR_PARTIAL_DEPLOY,
      `Deploy missing contracts: ${missing.join(", ")}. See the commands above.`
    );
  }

  return true;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check local Caatinga, Stellar CLI, Rust, config, and source identity setup")
    .option("-n, --network <network>", "Configured network name to validate")
    .option("-s, --source <source>", "Stellar CLI identity alias to validate")
    .option("--allow-untested-stellar-cli", "Allow local use of a Stellar CLI version newer than Caatinga's tested maximum")
    .action((options: DoctorOptions) => runCliAction(async () => {
      logger.info("Caatinga Doctor");
      logger.info("");

      const diagnostics = await runAllDiagnostics(options);

      for (const diagnostic of diagnostics) {
        printDiagnostic(diagnostic);
      }

      printFixes(diagnostics);

      let ready = diagnostics.every((diagnostic) => diagnostic.ok);

      if (options.network && ready) {
        try {
          await reportDeployCoverage(options.network);
        } catch (error) {
          ready = false;
          throw error;
        }
      }

      logger.info("");
      logger.info(`Status: ${ready ? "ready" : "blocked"}`);

      if (!ready) {
        process.exitCode = 1;
      }
    }));
}

export { sourceDiagnostic } from "../diagnostics/source-diagnostic.js";
