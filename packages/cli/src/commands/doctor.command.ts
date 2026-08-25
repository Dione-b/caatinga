import { Command } from "commander";
import { runAllDiagnostics } from "../diagnostics/run-all.js";
import { printDiagnostic, printFixes } from "../diagnostics/types.js";
import { evaluateDeployCoverage, type DeployCoverageLine } from "./doctor-deploy-coverage.js";
import { evaluateBindingCoverage, type BindingCoverageLine } from "./doctor-bindings.js";
import { evaluateEnvSyncDiagnostics } from "./doctor-env-sync.js";
import { evaluatePostDeployDiagnostics } from "./doctor-post-deploy.js";
import { evaluateWasmDriftDiagnostics } from "./doctor-wasm-drift.js";
import { reportCliVersionChannel } from "./doctor-cli-version.js";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { loadConfig, readContractSorobanSdkVersions, WELL_KNOWN_NETWORKS } from "@caatinga/core";

type DoctorOptions = {
  network?: string;
  source?: string;
  allNetworks?: boolean;
  strictEnv?: boolean;
  strictBindings?: boolean;
  strict?: boolean;
};

function printDeployCoverageLine(line: DeployCoverageLine): void {
  if (line.ok) {
    logger.info(`✓ ${line.name} — ${line.contractId}`);
    return;
  }

  logger.info(`✗ ${line.name}`);
  if (line.fix) logger.info(`  ${line.fix}`);
}

/** Advisory only: missing deploy coverage never flips doctor to blocked. */
export async function reportDeployCoverage(networkName: string): Promise<void> {
  const coverage = await evaluateDeployCoverage({ networkName });

  logger.info("");
  logger.info(`Deploy coverage (${networkName}):`);
  for (const line of coverage.lines) {
    printDeployCoverageLine(line);
  }

  if (!coverage.complete) {
    const missing = coverage.lines.filter((line) => !line.ok).map((line) => line.name);
    logger.info("");
    logger.info(
      `Advisory: not all configured contracts are deployed on ${networkName} (${missing.join(", ")}).`
    );
  }
}

function printBindingCoverageLine(line: BindingCoverageLine): void {
  if (line.status === "fresh") {
    logger.info(`✓ ${line.name} — bindings fresh`);
    return;
  }

  logger.info(`✗ ${line.name} — bindings ${line.status}${line.reason ? ` (${line.reason})` : ""}`);
  // The fix can be a multi-line config snippet, so indent every line, not just the first.
  if (line.fix) {
    for (const fixLine of line.fix.split("\n")) {
      logger.info(fixLine ? `  ${fixLine}` : "");
    }
  }
}

/** Advisory only: stale bindings never flip doctor to blocked unless --strict-bindings. */
export async function reportBindingCoverage(
  networkName: string,
  strictBindings: boolean
): Promise<boolean> {
  const coverage = await evaluateBindingCoverage({ networkName });

  if (coverage.lines.length === 0) {
    return false;
  }

  logger.info("");
  logger.info(`Bindings (${networkName}):`);
  for (const line of coverage.lines) {
    printBindingCoverageLine(line);
  }

  const stale = coverage.lines.some((line) => line.status !== "fresh");
  if (stale && strictBindings) {
    logger.info("");
    logger.info("Strict: stale or missing bindings block readiness.");
  }

  return stale && strictBindings;
}

async function reportEnvDrift(networkName: string, strictEnv: boolean): Promise<boolean> {
  const { report, lines } = await evaluateEnvSyncDiagnostics({ networkName });
  if (!report) {
    return false;
  }

  logger.info("");
  logger.info(`Env sync (${networkName}) — ${report.envFile}:`);
  if (report.inSync) {
    logger.info("✓ env file matches artifacts");
    return false;
  }

  for (const line of lines) {
    logger.info(
      `✗ ${line.envKey}: env=${line.envValue ?? "(missing)"} expected=${line.expectedValue}`
    );
    logger.info(`  ${line.fix}`);
  }

  if (strictEnv) {
    logger.info("");
    logger.info("Strict: env drift blocks readiness.");
  }

  return strictEnv;
}

async function reportPostDeployAdvisories(
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<void> {
  const lines = evaluatePostDeployDiagnostics(config);
  if (lines.length === 0) {
    return;
  }

  logger.info("");
  logger.info("Post-deploy args (advisory):");
  for (const line of lines) {
    logger.info(`✗ ${line.contract}.${line.method} arg "${line.arg}" = "${line.value}"`);
    if (line.fix) logger.info(`  ${line.fix}`);
  }
}

async function reportWasmDrift(networkName: string): Promise<void> {
  const lines = await evaluateWasmDriftDiagnostics({ networkName });
  if (lines.length === 0) {
    return;
  }

  logger.info("");
  logger.info(`WASM drift (${networkName}):`);
  for (const line of lines) {
    logger.info(
      `✗ ${line.contract} — local ${line.localWasmHash?.slice(0, 8) ?? "?"} vs artifact ${line.artifactWasmHash?.slice(0, 8) ?? "?"}`
    );
    if (line.fix) logger.info(`  ${line.fix}`);
  }
}

async function reportVersionMatrix(config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  logger.info("");
  logger.info("Version matrix (minimum):");
  logger.info("  Stellar CLI: >= 23 (27 recommended)");
  logger.info("  @stellar/stellar-sdk: >= 13");

  const sdkVersions = await readContractSorobanSdkVersions(config);
  if (sdkVersions.length > 0) {
    logger.info("  soroban-sdk (from contract Cargo.toml):");
    for (const entry of sdkVersions) {
      if (entry.sorobanSdk) {
        logger.info(`    ${entry.contract}: ${entry.sorobanSdk}`);
      } else {
        logger.info(`    ${entry.contract}: (not found in ${entry.cargoPath})`);
      }
    }
  }
}

async function reportAllNetworks(config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  logger.info("");
  logger.info("All networks:");
  for (const networkName of Object.keys(config.networks)) {
    logger.info("");
    logger.info(`  ${networkName}:`);
    await reportDeployCoverage(networkName);
    await reportBindingCoverage(networkName, false);
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check local Caatinga, Stellar CLI, Rust, config, and source identity setup")
    .option("-n, --network <network>", "Configured network name to validate")
    .option("-s, --source <source>", "Stellar CLI identity alias to validate")
    .option("--all-networks", "Report deploy and bindings coverage for every configured network")
    .option("--strict-env", "Fail when frontend env file drifts from artifacts")
    .option("--strict-bindings", "Fail when bindings are stale or missing")
    .option("--strict", "Enable --strict-env and --strict-bindings")
    .action((options: DoctorOptions) =>
      runCliAction(async () => {
        logger.info("Caatinga Doctor");
        logger.info("");

        const strictEnv = options.strictEnv === true || options.strict === true;
        const strictBindings = options.strictBindings === true || options.strict === true;

        const { diagnostics, config } = await runAllDiagnostics(options);

        for (const diagnostic of diagnostics) {
          printDiagnostic(diagnostic);
        }

        printFixes(diagnostics);

        const sourceFailed = diagnostics.some(
          (diagnostic) => !diagnostic.ok && diagnostic.label.includes("source identity")
        );
        if (sourceFailed) {
          logger.info("");
          logger.info("Signing: see docs/signing-strategy.md for --source and wallet models.");
        }

        const ready = diagnostics.every((diagnostic) => diagnostic.ok);

        // Advisory only: never contributes to `blocked`. Surfaces when this install
        // is a pre-release (for example published under the `next` dist-tag).
        await reportCliVersionChannel();

        let deployNetwork = options.network;
        if (!deployNetwork && ready && config) {
          deployNetwork = config.defaultNetwork;
        }

        let blocked = !ready;

        if (config && options.allNetworks) {
          await reportAllNetworks(config);
        } else if (deployNetwork && ready && config) {
          await reportDeployCoverage(deployNetwork);
          const bindingsBlocked = await reportBindingCoverage(deployNetwork, strictBindings);
          blocked = blocked || bindingsBlocked;

          const envBlocked = await reportEnvDrift(deployNetwork, strictEnv);
          blocked = blocked || envBlocked;

          await reportPostDeployAdvisories(config);
          await reportWasmDrift(deployNetwork);
          await reportVersionMatrix(config);
        }

        logger.info("");
        logger.info(`Status: ${blocked ? "blocked" : "ready"}`);
        logger.info("Production checklist: docs/production-readiness.md");
        logger.info(`Known networks: ${Object.keys(WELL_KNOWN_NETWORKS).join(", ")}`);

        if (blocked) {
          process.exitCode = 1;
        }
      })
    );
}

export { sourceDiagnostic } from "../diagnostics/source-diagnostic.js";
