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

function mergeZkIntoConfigSource(source: string): string {
  let next = source;

  if (!next.includes("verifier:")) {
    next = next.replace(
      /contracts:\s*\{([\s\S]*?)\n {2}\},/,
      `contracts: {$1
    verifier: {
      path: "./contracts/verifier",
      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm"
    },
  },`
    );
  }

  if (!next.includes("zk:")) {
    next = next.replace(
      /\n\}\);\s*$/,
      `,
  zk: {
    circuits: {
      main: {
        path: "./circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier"
      }
    }
  }
});
`
    );
  }

  return next;
}

async function mergeZkIntoConfig(cwd: string): Promise<void> {
  const configPath = path.join(cwd, "caatinga.config.ts");
  if (!(await exists(configPath))) {
    return;
  }

  const source = await readFile(configPath, "utf8");
  const merged = mergeZkIntoConfigSource(source);
  if (merged !== source) {
    await writeFile(configPath, merged, "utf8");
  }
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
            "No caatinga.config.ts found in the current directory. Run `caatinga zk init <projectName>` to create a new project."
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
          await mergeZkIntoConfig(cwd);
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
        await mergeZkIntoConfig(cwd);

        logger.success("Added ZK circuit and verifier scaffold to the current project");
      });
    });
}
