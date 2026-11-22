import { access, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { loadConfig, readArtifacts } from "@caatinga/core";
import { Command } from "commander";
import { logger } from "../utils/logger.js";

export type FixOptions = {
  dryRun?: boolean;
  yes?: boolean;
  includeOrphanJs?: boolean;
};

type FixPlan = {
  orphanJsPath?: string;
  orphanBackupPath?: string;
  configValid: boolean;
  artifactsValid: boolean;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function canonicalConfigName(cwd: string): Promise<string> {
  const manifestPath = path.join(cwd, "caatinga.template.json");
  if (!(await exists(manifestPath))) return "caatinga.config.ts";

  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files?: { config?: string };
    };
    return manifest.files?.config ?? "caatinga.config.ts";
  } catch {
    return "caatinga.config.ts";
  }
}

async function uniqueBackupPath(filePath: string): Promise<string> {
  const preferred = `${filePath}.bak`;
  if (!(await exists(preferred))) return preferred;
  return `${filePath}.bak.${Date.now()}`;
}

export async function planFix(cwd = process.cwd()): Promise<FixPlan> {
  const configPath = path.join(cwd, await canonicalConfigName(cwd));
  const orphanJsPath = path.join(cwd, "caatinga.config.js");

  let configValid = false;
  try {
    await loadConfig({ cwd, configPath: path.relative(cwd, configPath) });
    configValid = true;
  } catch {
    // The command deliberately reports the existing diagnostic instead of trying
    // to synthesize a user's deployment configuration.
  }

  let artifactsValid = false;
  try {
    await readArtifacts(cwd);
    artifactsValid = true;
  } catch {
    // See the config note above: artifacts need on-chain context to regenerate.
  }

  const orphanDetected =
    (await exists(configPath)) &&
    path.basename(configPath) === "caatinga.config.ts" &&
    (await exists(orphanJsPath));

  return {
    configValid,
    artifactsValid,
    orphanJsPath: orphanDetected ? orphanJsPath : undefined,
    orphanBackupPath: orphanDetected ? await uniqueBackupPath(orphanJsPath) : undefined,
  };
}

async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const { createInterface } = await import("node:readline/promises");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    readline.close();
  }
}

export async function runFix(options: FixOptions, cwd = process.cwd()): Promise<void> {
  const plan = await planFix(cwd);
  const actions: string[] = [];

  if (plan.orphanJsPath && plan.orphanBackupPath) {
    actions.push(
      `move ${path.basename(plan.orphanJsPath)} to ${path.basename(plan.orphanBackupPath)}`
    );
  }

  if (!plan.configValid) {
    actions.push(
      "repair caatinga.config.ts (manual repair required; no safe automatic patch exists)"
    );
  }
  if (!plan.artifactsValid) {
    actions.push(
      "repair caatinga.artifacts.json (regeneration requires reachable deployment context)"
    );
  }

  if (actions.length === 0) {
    logger.success("Caatinga project is clean; no repairs needed.");
    return;
  }

  logger.info(options.dryRun ? "Repair plan (dry run):" : "Repair plan:");
  for (const action of actions) logger.info(`- ${action}`);

  const unrecoverable = !plan.configValid || !plan.artifactsValid;
  if (unrecoverable) {
    logger.warn("Some corruption cannot be repaired safely without user or on-chain input.");
  }

  if (options.dryRun) {
    if (unrecoverable) process.exitCode = 2;
    return;
  }

  if (plan.orphanJsPath && plan.orphanBackupPath) {
    if (!options.includeOrphanJs) {
      logger.info("Orphan config detected; pass --include-orphan-js to move it to a backup.");
    } else {
      const approved =
        options.yes === true || (await confirm("Move the orphan config to a backup?"));
      if (!approved) {
        logger.info("No changes made.");
      } else {
        await stat(plan.orphanJsPath);
        await rename(plan.orphanJsPath, plan.orphanBackupPath);
        logger.success(`Backed up orphan config to ${path.basename(plan.orphanBackupPath)}.`);
      }
    }
  }

  if (unrecoverable) process.exitCode = 2;
}

export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description("Inspect and safely repair corrupted Caatinga project files")
    .option("--dry-run", "Print the repair plan without changing files")
    .option("--yes", "Approve non-interactive repairs")
    .option("--include-orphan-js", "Back up an orphan caatinga.config.js")
    .action((options: FixOptions) => runFix(options));
}
