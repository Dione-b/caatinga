import { access } from "node:fs/promises";
import { Command } from "commander";
import {
  assertSupportedStellarCliVersion,
  CaatingaError,
  loadConfig,
  parseStellarCliVersion,
  readArtifacts,
  resolveNetwork,
  runCommand
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

type DoctorOptions = {
  network?: string;
  source?: string;
  allowUntestedStellarCli?: boolean;
};

type Diagnostic = {
  ok: boolean;
  label: string;
  fix?: string;
};

const NODE_MIN_MAJOR = 20;
const WASM_TARGET = "wasm32v1-none";

function nodeDiagnostic(): Diagnostic {
  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);

  if (major < NODE_MIN_MAJOR) {
    return {
      ok: false,
      label: `Node.js ${version} is below the required minimum ${NODE_MIN_MAJOR}.0.0`,
      fix: `Install Node.js ${NODE_MIN_MAJOR} or newer.`
    };
  }

  return { ok: true, label: `Node.js ${version}` };
}

async function stellarDiagnostic(allowUntested: boolean): Promise<Diagnostic> {
  try {
    const result = await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true
    });
    const version = assertSupportedStellarCliVersion({
      version: parseStellarCliVersion(result.all || result.stdout || result.stderr),
      allowUntested
    });
    return { ok: true, label: `Stellar CLI ${version}` };
  } catch (error) {
    const hint = error instanceof CaatingaError ? error.hint : undefined;
    return {
      ok: false,
      label: "Stellar CLI not ready",
      fix: hint ?? "Install Stellar CLI: cargo install --locked stellar-cli --version 25.2.0"
    };
  }
}

async function rustDiagnostic(): Promise<Diagnostic> {
  try {
    const result = await runCommand("rustc", ["--version"]);
    return { ok: true, label: result.stdout || result.all || "Rust installed" };
  } catch {
    return {
      ok: false,
      label: "Rust not found",
      fix: "Install Rust, then run: rustup target add wasm32v1-none"
    };
  }
}

async function wasmTargetDiagnostic(): Promise<Diagnostic> {
  try {
    const result = await runCommand("rustup", ["target", "list", "--installed"]);
    const installedTargets = result.stdout || result.all;

    if (installedTargets.split(/\r?\n/).includes(WASM_TARGET)) {
      return { ok: true, label: `${WASM_TARGET} target installed` };
    }

    return {
      ok: false,
      label: `${WASM_TARGET} target not installed`,
      fix: `Run: rustup target add ${WASM_TARGET}`
    };
  } catch {
    return {
      ok: false,
      label: "rustup not found",
      fix: "Install rustup, then run: rustup target add wasm32v1-none"
    };
  }
}

async function configDiagnostic(): Promise<Diagnostic> {
  try {
    await loadConfig();
    return { ok: true, label: "caatinga.config.ts found" };
  } catch (error) {
    const hint = error instanceof CaatingaError ? error.hint : undefined;
    return {
      ok: false,
      label: "caatinga.config.ts not ready",
      fix: hint ?? "Run this command from a Caatinga project root."
    };
  }
}

async function artifactsDiagnostic(): Promise<Diagnostic> {
  try {
    await access("caatinga.artifacts.json");
    await readArtifacts();
    return { ok: true, label: "caatinga.artifacts.json found" };
  } catch {
    return {
      ok: false,
      label: "caatinga.artifacts.json not found or invalid",
      fix: "Run caatinga init, or restore a valid caatinga.artifacts.json file."
    };
  }
}

async function networkDiagnostic(networkName: string | undefined): Promise<Diagnostic | undefined> {
  if (!networkName) return undefined;

  try {
    const config = await loadConfig();
    const network = resolveNetwork(config, networkName);
    return { ok: true, label: `network ${network.name} found` };
  } catch (error) {
    const hint = error instanceof CaatingaError ? error.hint : undefined;
    return {
      ok: false,
      label: `network ${networkName} not found`,
      fix: hint ?? `Add "${networkName}" to caatinga.config.ts networks.`
    };
  }
}

async function sourceDiagnostic(source: string | undefined): Promise<Diagnostic | undefined> {
  if (!source) return undefined;

  if (source.startsWith("G")) {
    return {
      ok: false,
      label: `source identity ${source} is a public address`,
      fix: "--source must be a local Stellar CLI identity, not a public G... address."
    };
  }

  try {
    await runCommand("stellar", ["keys", "public-key", source]);
    return { ok: true, label: `source identity ${source} found` };
  } catch {
    return {
      ok: false,
      label: `source identity ${source} not found`,
      fix: `Create and fund it: stellar keys generate ${source} --fund --network testnet`
    };
  }
}

function printDiagnostic(diagnostic: Diagnostic): void {
  logger.info(`${diagnostic.ok ? "✓" : "✗"} ${diagnostic.label}`);
}

function printFixes(diagnostics: Diagnostic[]): void {
  const failures = diagnostics.filter((diagnostic) => !diagnostic.ok);
  if (failures.length === 0) return;

  logger.info("");
  logger.info("Fix:");
  for (const failure of failures) {
    if (failure.fix) logger.info(failure.fix);
  }
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

      const diagnostics = [
        nodeDiagnostic(),
        await stellarDiagnostic(options.allowUntestedStellarCli === true),
        await rustDiagnostic(),
        await wasmTargetDiagnostic(),
        await configDiagnostic(),
        await artifactsDiagnostic(),
        await networkDiagnostic(options.network),
        await sourceDiagnostic(options.source)
      ].filter((diagnostic): diagnostic is Diagnostic => diagnostic !== undefined);

      for (const diagnostic of diagnostics) {
        printDiagnostic(diagnostic);
      }

      printFixes(diagnostics);

      const ready = diagnostics.every((diagnostic) => diagnostic.ok);
      logger.info("");
      logger.info(`Status: ${ready ? "ready" : "blocked"}`);

      if (!ready) {
        process.exitCode = 1;
      }
    }));
}
