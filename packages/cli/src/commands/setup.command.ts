import { Command } from "commander";
import { execa } from "execa";
import {
  CaatingaError,
  CaatingaErrorCode,
  checkStellarCliVersion,
  resolveSubprocessEnv,
  runCommand,
  STELLAR_CLI_LAST_TESTED_VERSION,
  STELLAR_CLI_MIN_VERSION,
} from "@caatinga/core";
import {
  CURRENT_RUST_WASM_TARGET,
  NODE_MIN_MAJOR,
  RUST_MIN_VERSION,
} from "@caatinga/core/runtime/requirements";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type SetupOptions = {
  source: string;
  network: string;
  skipIdentity?: boolean;
  skipRust?: boolean;
  skipStellar?: boolean;
};

type StepResult = {
  ok: boolean;
  label: string;
  skipped?: boolean;
  installed?: boolean;
};

// Networks served by a friendbot, where `stellar keys generate --fund` works.
const FUNDABLE_NETWORKS = new Set(["testnet", "futurenet", "local", "standalone"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function semverAtLeast(version: string, minVersion: string): boolean {
  const parsed = parseSemver(version);
  const min = parseSemver(minVersion);
  if (!parsed || !min) return false;

  for (let i = 0; i < 3; i++) {
    if (parsed[i] > min[i]) return true;
    if (parsed[i] < min[i]) return false;
  }
  return true;
}

/** Runs subprocesses with ~/.cargo/bin prepended so freshly-installed tools resolve. */
const execEnv = (): NodeJS.ProcessEnv => resolveSubprocessEnv();

async function detectRustVersion(): Promise<string | null> {
  try {
    const result = await runCommand("rustc", ["--version"]);
    const raw = result.stdout || result.all;
    const match = raw.match(/rustc\s+([\d.]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function rustWindowsMessage(detected: string | null): string {
  const head = detected
    ? `Rust ${detected} is below the required ${RUST_MIN_VERSION}.`
    : "Rust was not found.";
  return [
    head,
    "On Windows, install or update Rust manually:",
    "  • winget install Rustlang.Rustup   (then run: rustup default stable)",
    "  • or download rustup-init.exe from https://rustup.rs",
    "Re-run caatinga setup afterwards.",
  ].join("\n  ");
}

function stellarInstallFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return [
    `Stellar CLI installation failed: ${message}`,
    "Building from source needs a C toolchain and headers:",
    "  • Debian/Ubuntu: sudo apt install build-essential pkg-config libudev-dev libdbus-1-dev",
    "  • Fedora: sudo dnf install gcc pkg-config systemd-devel dbus-devel",
    "  • macOS: xcode-select --install",
    "Or install a prebuilt binary (faster, no compiler needed):",
    `  cargo binstall stellar-cli --version ${STELLAR_CLI_LAST_TESTED_VERSION}`,
    "  or download a release from https://github.com/stellar/stellar-cli/releases",
  ].join("\n  ");
}

// ─── Steps ───────────────────────────────────────────────────────────────────

export function checkNodeStep(): StepResult {
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0], 10);

  if (major >= NODE_MIN_MAJOR) {
    return { ok: true, label: `Node.js ${nodeVersion} (meets minimum v${NODE_MIN_MAJOR})` };
  }

  return {
    ok: false,
    label: [
      `Node.js ${nodeVersion} is below the required v${NODE_MIN_MAJOR}.`,
      `Update Node.js before continuing: https://nodejs.org`,
      `Version managers: nvm (https://github.com/nvm-sh/nvm) or fnm (https://fnm.vercel.app)`,
    ].join("\n  "),
  };
}

export async function installRustStep(): Promise<StepResult> {
  const detected = await detectRustVersion();

  if (detected && semverAtLeast(detected, RUST_MIN_VERSION)) {
    return {
      ok: true,
      label: `Rust ${detected} (meets minimum ${RUST_MIN_VERSION})`,
      skipped: true,
    };
  }

  // Auto-install relies on the rustup `curl | sh` flow, which is Unix-only.
  if (process.platform === "win32") {
    return { ok: false, label: rustWindowsMessage(detected) };
  }

  if (detected) {
    // Rust present but too old — update via rustup (if available).
    logger.info(`  ⧗ Rust ${detected} is below ${RUST_MIN_VERSION}. Updating via rustup...`);
    try {
      await execa("rustup", ["update", "stable"], { stdio: "inherit", env: execEnv() });
    } catch {
      return {
        ok: false,
        label: `Rust ${detected} is below ${RUST_MIN_VERSION} and could not be updated via rustup (rustup may not be installed). Update Rust manually or install rustup: https://rustup.rs`,
      };
    }
  } else {
    // Rust not found — install via rustup.
    logger.info("  ⧗ Rust not found. Installing via rustup...");
    await execa(
      "sh",
      ["-c", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"],
      { stdio: "inherit" }
    );
  }

  const updated = await detectRustVersion();
  if (!updated) {
    return {
      ok: false,
      label:
        'Rust installation completed, but rustc is still not on PATH. Restart your terminal (or run: source "$HOME/.cargo/env") and re-run caatinga setup.',
    };
  }

  return {
    ok: true,
    label: `Rust ${updated} ${detected ? "updated" : "installed"}`,
    installed: true,
  };
}

export async function installWasmTargetStep(): Promise<StepResult> {
  try {
    const result = await runCommand("rustup", ["target", "list", "--installed"]);
    const installed = (result.stdout || result.all).split(/\r?\n/);

    if (installed.includes(CURRENT_RUST_WASM_TARGET)) {
      return {
        ok: true,
        label: `${CURRENT_RUST_WASM_TARGET} target already installed`,
        skipped: true,
      };
    }

    logger.info(`  ⧗ Adding ${CURRENT_RUST_WASM_TARGET} target...`);
    await execa("rustup", ["target", "add", CURRENT_RUST_WASM_TARGET], {
      stdio: "inherit",
      env: execEnv(),
    });
    return { ok: true, label: `${CURRENT_RUST_WASM_TARGET} target installed`, installed: true };
  } catch {
    return {
      ok: false,
      label: `Failed to install ${CURRENT_RUST_WASM_TARGET}. Ensure rustup is installed and retry.`,
    };
  }
}

export async function installStellarCliStep(): Promise<StepResult> {
  try {
    // Validates the installed CLI against STELLAR_CLI_MIN_VERSION; throws if too old or absent.
    const report = await checkStellarCliVersion({ probeFeatures: false });
    return {
      ok: true,
      label: `Stellar CLI ${report.version} (meets minimum ${STELLAR_CLI_MIN_VERSION})`,
      skipped: true,
    };
  } catch (error) {
    const belowMin =
      error instanceof CaatingaError && error.code === CaatingaErrorCode.UNSUPPORTED_CLI_VERSION;

    if (belowMin) {
      logger.info(
        `  ⧗ Installed Stellar CLI is below the supported minimum ${STELLAR_CLI_MIN_VERSION}. Installing ${STELLAR_CLI_LAST_TESTED_VERSION} via cargo (this may take several minutes)...`
      );
    } else {
      logger.info(
        `  ⧗ Stellar CLI not found. Installing ${STELLAR_CLI_LAST_TESTED_VERSION} via cargo (this may take several minutes)...`
      );
    }

    try {
      await execa(
        "cargo",
        ["install", "--locked", "stellar-cli", "--version", STELLAR_CLI_LAST_TESTED_VERSION],
        { stdio: "inherit", env: execEnv() }
      );

      const report = await checkStellarCliVersion({ probeFeatures: false });
      return { ok: true, label: `Stellar CLI ${report.version} installed`, installed: true };
    } catch (installError) {
      return { ok: false, label: stellarInstallFailureMessage(installError) };
    }
  }
}

export async function createIdentityStep(source: string, network: string): Promise<StepResult> {
  try {
    await runCommand("stellar", ["keys", "public-key", source], {
      skipStellarVersionCheck: true,
    });
    return { ok: true, label: `Identity "${source}" already exists`, skipped: true };
  } catch {
    const fundable = FUNDABLE_NETWORKS.has(network.toLowerCase());
    const args = fundable
      ? ["keys", "generate", source, "--fund", "--network", network]
      : ["keys", "generate", source, "--network", network];

    logger.info(
      `  ⧗ Generating identity "${source}"${fundable ? ` and funding it on ${network}` : ` on ${network}`}...`
    );

    try {
      await execa("stellar", args, { stdio: "inherit", env: execEnv() });

      if (fundable) {
        return {
          ok: true,
          label: `Identity "${source}" created and funded on ${network}`,
          installed: true,
        };
      }

      return {
        ok: true,
        label: `Identity "${source}" created on ${network} (not funded — ${network} has no friendbot; fund it manually before deploying)`,
        installed: true,
      };
    } catch (genError) {
      const message = genError instanceof Error ? genError.message : String(genError);
      return {
        ok: false,
        label: `Failed to create identity "${source}": ${message}`,
      };
    }
  }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

const DOUBLE_LINE = "═".repeat(46);
const SINGLE_LINE = "─".repeat(50);

function printStepHeader(index: number, total: number, title: string): void {
  logger.info("");
  logger.info(`Step ${index}/${total} — ${title}`);
}

function printStepResult(result: StepResult): void {
  if (result.ok) {
    logger.info(`  ✓ ${result.label}`);
  } else {
    logger.info(`  ✗ ${result.label}`);
  }
}

export async function runSetup(options: SetupOptions): Promise<void> {
  const TOTAL_STEPS = 5;
  const results: StepResult[] = [];
  let skippedSteps = 0;

  logger.info("");
  logger.info("Caatinga Setup");
  logger.info(DOUBLE_LINE);

  // Step 1 — Node.js
  printStepHeader(1, TOTAL_STEPS, "Node.js");
  const nodeResult = checkNodeStep();
  printStepResult(nodeResult);

  if (!nodeResult.ok) {
    logger.info("");
    logger.info(SINGLE_LINE);
    logger.info("  ✖ Setup aborted — Node.js requirement not met");
    logger.info(SINGLE_LINE);
    process.exitCode = 1;
    return;
  }

  // Steps 2–3 — Rust toolchain + WASM target
  let rustOk = true;

  if (options.skipRust) {
    printStepHeader(2, TOTAL_STEPS, "Rust toolchain");
    logger.info("  — skipped (--skip-rust)");
    printStepHeader(3, TOTAL_STEPS, "WebAssembly target");
    logger.info("  — skipped (--skip-rust)");
    skippedSteps += 2;
  } else {
    printStepHeader(2, TOTAL_STEPS, "Rust toolchain");
    const rustResult = await installRustStep();
    printStepResult(rustResult);
    results.push(rustResult);
    rustOk = rustResult.ok;

    printStepHeader(3, TOTAL_STEPS, "WebAssembly target");
    if (!rustOk) {
      logger.info("  — skipped (Rust step failed)");
    } else {
      const wasmResult = await installWasmTargetStep();
      printStepResult(wasmResult);
      results.push(wasmResult);
      rustOk = wasmResult.ok;
    }
  }

  // Step 4 — Stellar CLI
  let stellarOk = true;

  printStepHeader(4, TOTAL_STEPS, "Stellar CLI");
  if (options.skipStellar) {
    logger.info("  — skipped (--skip-stellar)");
    skippedSteps += 1;
  } else {
    const stellarResult = await installStellarCliStep();
    printStepResult(stellarResult);
    results.push(stellarResult);
    stellarOk = stellarResult.ok;
  }

  // Step 5 — Local identity
  let identityOk = true;

  printStepHeader(5, TOTAL_STEPS, `Local identity "${options.source}"`);
  if (options.skipIdentity) {
    logger.info("  — skipped (--skip-identity)");
    skippedSteps += 1;
  } else {
    const identityResult = await createIdentityStep(options.source, options.network);
    printStepResult(identityResult);
    results.push(identityResult);
    identityOk = identityResult.ok;
  }

  // Summary
  logger.info("");
  logger.info(SINGLE_LINE);

  const allOk = rustOk && stellarOk && identityOk;
  const anyInstalled = results.some((result) => result.installed);

  if (allOk) {
    if (skippedSteps > 0) {
      logger.info(
        `  ✔ Setup finished — ${skippedSteps} step${skippedSteps === 1 ? "" : "s"} skipped; remaining prerequisites satisfied`
      );
    } else {
      logger.info("  ✔ Setup complete — all prerequisites satisfied");
    }
    logger.info(SINGLE_LINE);

    if (anyInstalled) {
      logger.info("");
      logger.info("Note: tools were installed during this run.");
      logger.info("If `cargo` or `stellar` are not found, restart your terminal or run:");
      logger.info('  source "$HOME/.cargo/env"');
    }

    logger.info("");
    logger.info("Next steps:");
    logger.info("  caatinga init my-dapp");
    logger.info("  cd my-dapp && npm install");
    logger.info("  caatinga doctor");
  } else {
    logger.info("  ✖ Setup completed with errors — review the steps above");
    logger.info(SINGLE_LINE);
    process.exitCode = 1;
  }

  logger.info("");
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Verify and install all prerequisites for Stellar/Soroban development in one step")
    .option("-s, --source <name>", "Identity alias to create", "alice")
    .option("-n, --network <network>", "Network to fund the identity on", "testnet")
    .option("--skip-identity", "Skip identity creation (step 5)")
    .option("--skip-rust", "Skip Rust and WASM target installation (steps 2–3)")
    .option("--skip-stellar", "Skip Stellar CLI installation (step 4)")
    .action((options: SetupOptions) =>
      runCliAction(async () => {
        await runSetup(options);
      })
    );
}
