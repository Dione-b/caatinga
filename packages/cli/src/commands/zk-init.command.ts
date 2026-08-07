import { type Command } from "commander";
import { createProjectFromTemplate, createZkProject, loadConfig } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { resolveTemplateDir } from "../utils/template-path.js";
import path from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";
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

const ZK_VERIFIER_BLOCK = [
  "    verifier: {",
  '      path: "./contracts/verifier",',
  '      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm"',
  "    },",
].join("\n");

const ZK_CONFIG_BLOCK = [
  "  zk: {",
  "    circuits: {",
  "      main: {",
  '        path: "./circuits",',
  '        protocol: "groth16",',
  '        curve: "bls12381",',
  '        verifierContract: "verifier"',
  "      }",
  "    }",
  "  }",
].join("\n");

function mergeZkIntoConfigSource(source: string): { merged: string; changed: boolean } {
  let next = source;

  const needsVerifier = !next.includes("verifier:");
  const needsZk = !next.includes("zk:");

  if (!needsVerifier && !needsZk) {
    return { merged: source, changed: false };
  }

  if (needsVerifier) {
    const before = next;
    // Match contracts block closing at 2-space indent (not inner contract entries).
    next = next.replace(
      /contracts:\s*\{([\s\S]*?)\n {2}\},/,
      "contracts: {$1\n" + ZK_VERIFIER_BLOCK + "\n  },"
    );
    if (next === before) {
      return { merged: source, changed: false };
    }
  }

  if (needsZk) {
    const before = next;
    if (/,\n\}\);?\s*$/.test(next)) {
      next = next.replace(/,\n\}\);?\s*$/, ",\n" + ZK_CONFIG_BLOCK + "\n});\n");
    } else {
      next = next.replace(/\n\}\);?\s*$/, ",\n" + ZK_CONFIG_BLOCK + "\n});\n");
    }
    if (next === before) {
      return { merged: source, changed: false };
    }
  }

  const complete = next.includes("verifier:") && next.includes("zk:");
  if (!complete || next === source) {
    return { merged: source, changed: false };
  }

  return { merged: next, changed: true };
}

function printManualZkConfigInstructions(): void {
  logger.warn("Could not automatically add ZK config to caatinga.config.ts.");
  logger.info("Add the following to your caatinga.config.ts manually:");
  logger.info("");
  logger.info('  1. In the "contracts" section, add:');
  logger.info("     verifier: {");
  logger.info('       path: "./contracts/verifier",');
  logger.info('       wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm"');
  logger.info("     },");
  logger.info("");
  logger.info("  2. Before the closing });, add:");
  logger.info("  zk: {");
  logger.info("    circuits: {");
  logger.info("      main: {");
  logger.info('        path: "./circuits",');
  logger.info('        protocol: "groth16",');
  logger.info('        curve: "bls12381",');
  logger.info('        verifierContract: "verifier"');
  logger.info("      }");
  logger.info("    }");
  logger.info("  }");
  logger.info("");
}

export { mergeZkIntoConfigSource };

async function mergeZkIntoConfig(cwd: string): Promise<boolean> {
  const configPath = path.join(cwd, "caatinga.config.ts");
  if (!(await exists(configPath))) {
    return false;
  }

  const source = await readFile(configPath, "utf8");
  const { merged, changed } = mergeZkIntoConfigSource(source);
  if (changed) {
    await writeFile(configPath, merged, "utf8");
    return true;
  }

  printManualZkConfigInstructions();
  return false;
}

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
        try {
          config = await loadConfig({ cwd });
        } catch {
          throw new Error(
            "No caatinga.config.ts found in the current directory. Run `ctg zk init <projectName>` to create a new project."
          );
        }

        await assertCanWriteZkScaffold(cwd, Boolean(options.force));

        if (options.minimal) {
          await createZkProject({
            projectName: config.project,
            targetDir: cwd,
            force: true,
            projectFiles: false,
          });
          const configMerged = await mergeZkIntoConfig(cwd);
          if (!configMerged) {
            logger.warn(
              "ZK scaffold added but caatinga.config.ts could not be updated automatically — follow the instructions above."
            );
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
            relativePath === "contracts/verifier" ||
            relativePath.startsWith("contracts/verifier/"),
        });
        const configMerged = await mergeZkIntoConfig(cwd);
        if (!configMerged) {
          logger.warn(
            "ZK scaffold added but caatinga.config.ts could not be updated automatically — follow the instructions above."
          );
          process.exitCode = 1;
          return;
        }

        logger.success("Added ZK circuit and verifier scaffold to the current project");
      });
    });
}
