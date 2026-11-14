import { type Command } from "commander";
import {
  CaatingaError,
  CaatingaErrorCode,
  createProjectFromTemplate,
  createZkProject,
  loadConfig,
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { resolveTemplateDir } from "../utils/template-path.js";
import path from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";
import {
  manualZkConfigInstructions,
  mergeZkIntoConfigSource,
  scaffoldVerifierLacksAdmin,
  ZK_VERIFIER_DEPLOY_ARGS,
} from "../utils/zk-config-merge.js";
import { getOrCreateZkCommand } from "./zk.command.js";

const ZK_TEMPLATE = "zk-starter";

type ZkInitOptions = {
  template: string;
  minimal?: boolean;
  force?: boolean;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertCanWriteZkScaffold(cwd: string, force: boolean): Promise<void> {
  if (force) {
    return;
  }

  const conflicts = [
    path.join(cwd, "circuits", "main.circom"),
    path.join(cwd, "contracts", "verifier"),
  ];
  const existing = [];
  for (const conflict of conflicts) {
    if (await exists(conflict)) {
      existing.push(path.relative(cwd, conflict));
    }
  }

  if (existing.length > 0) {
    throw new Error(
      `ZK scaffold files already exist: ${existing.join(", ")}. Re-run with --force to overwrite them.`
    );
  }
}

function printManualZkConfigInstructions(): void {
  logger.warn("Could not automatically add ZK config to caatinga.config.ts.");
  logger.info("Add the following to your caatinga.config.ts manually:");
  logger.info("");
  for (const line of manualZkConfigInstructions()) {
    logger.info(line);
  }
}

async function mergeZkIntoConfig(cwd: string): Promise<boolean> {
  const configPath = path.join(cwd, "caatinga.config.ts");
  if (!(await exists(configPath))) {
    return false;
  }

  const source = await readFile(configPath, "utf8");
  const { merged, changed } = mergeZkIntoConfigSource(source);
  if (scaffoldVerifierLacksAdmin(merged)) {
    logger.warn(
      `The verifier entry in caatinga.config.ts has no admin deploy arg. Add \`${ZK_VERIFIER_DEPLOY_ARGS}\` to it: the verifier constructor requires an admin.`
    );
  }
  if (changed) {
    await writeFile(configPath, merged, "utf8");
    return true;
  }

  printManualZkConfigInstructions();
  return false;
}

// loadConfig joins schema issues into the hint; an exact match means it is the only issue.
const EMPTY_CONTRACTS_HINT = "contracts: At least one contract must be configured.";

function isOnlyEmptyContractsError(error: unknown): boolean {
  return (
    error instanceof CaatingaError &&
    error.code === CaatingaErrorCode.INVALID_CONFIG &&
    error.hint === EMPTY_CONTRACTS_HINT
  );
}

const CONFIG_NOT_UPDATED_WARNING =
  "ZK scaffold added but caatinga.config.ts could not be updated automatically — follow the instructions above.";

export function registerZkInitCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("init [projectName]")
    .description("Scaffold a new ZK-enabled project or add ZK files to the current project")
    .option("-t, --template <template>", "Template name", ZK_TEMPLATE)
    .option("--minimal", "Scaffold a minimal ZK project without copying a template")
    .option("--force", "Overwrite existing ZK scaffold files")
    .action(async (projectName: string | undefined, options: ZkInitOptions) => {
      await runCliAction(async () => {
        if (projectName) {
          const targetDir = path.resolve(projectName);
          if (options.minimal) {
            await createZkProject({
              projectName: path.basename(targetDir),
              targetDir,
              force: options.force,
            });
          } else {
            const templateDir = await resolveTemplateDir(options.template);
            await createProjectFromTemplate({
              projectName: path.basename(targetDir),
              targetDir,
              templateDir,
            });
          }
          logger.success(`Created ZK project at ${targetDir}`);
          return;
        }

        const cwd = process.cwd();
        let config;
        let configMerged = false;
        try {
          config = await loadConfig({ cwd });
        } catch (error) {
          // Only a missing config means "not a project"; surface every other load
          // failure (dependencies not installed, invalid config, syntax error) as is.
          if (error instanceof CaatingaError && error.code === CaatingaErrorCode.CONFIG_NOT_FOUND) {
            throw new Error(
              "No caatinga.config.ts found in the current directory. Run `ctg zk init <projectName>` to create a new project."
            );
          }
          if (!isOnlyEmptyContractsError(error)) {
            throw error;
          }
          // A project without contracts yet: adding the verifier makes the config valid.
          await assertCanWriteZkScaffold(cwd, Boolean(options.force));
          if (!(await mergeZkIntoConfig(cwd))) {
            logger.warn(
              "caatinga.config.ts has no contracts and could not be updated automatically — follow the instructions above."
            );
            process.exitCode = 1;
            return;
          }
          configMerged = true;
          config = await loadConfig({ cwd });
        }

        await assertCanWriteZkScaffold(cwd, Boolean(options.force));

        if (options.minimal) {
          await createZkProject({
            projectName: config.project,
            targetDir: cwd,
            force: true,
            projectFiles: false,
          });
          if (!configMerged && !(await mergeZkIntoConfig(cwd))) {
            logger.warn(CONFIG_NOT_UPDATED_WARNING);
            process.exitCode = 1;
            return;
          }
          logger.success("Added minimal ZK circuit and verifier scaffold to the current project");
          return;
        }

        const templateDir = await resolveTemplateDir(options.template);
        await createProjectFromTemplate({
          projectName: config.project,
          targetDir: cwd,
          templateDir,
          filter: (relativePath: string) =>
            relativePath === "circuits" ||
            relativePath.startsWith("circuits/") ||
            // fs.cp skips the whole subtree of a rejected directory, so the parent must pass too.
            relativePath === "contracts" ||
            relativePath === "contracts/verifier" ||
            relativePath.startsWith("contracts/verifier/"),
        });
        if (!configMerged && !(await mergeZkIntoConfig(cwd))) {
          logger.warn(CONFIG_NOT_UPDATED_WARNING);
          process.exitCode = 1;
          return;
        }

        logger.success("Added ZK circuit and verifier scaffold to the current project");
      });
    });
}
