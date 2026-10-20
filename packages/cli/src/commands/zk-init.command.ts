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

// The verifier's constructor takes the account allowed to call `upgrade`.
const ZK_VERIFIER_DEPLOY_ARGS = 'deployArgs: { admin: "${source.address}" }';

const ZK_VERIFIER_BLOCK = [
  "    verifier: {",
  '      path: "./contracts/verifier",',
  '      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",',
  `      ${ZK_VERIFIER_DEPLOY_ARGS}`,
  "    },",
].join("\n");

// A flat `verifier: { ... }` entry pointing at the scaffolded contract.
const SCAFFOLD_VERIFIER_ENTRY =
  /(\n([ \t]*)verifier:\s*\{)([^{}]*path:\s*["']\.\/contracts\/verifier["'][^{}]*?)(\n[ \t]*\})/;

const SCAFFOLD_VERIFIER_PATH = /path:\s*["']\.\/contracts\/verifier["']/g;

const ADMIN_DEPLOY_ARG = /deployArgs:\s*\{[^}]*\badmin\b/;

type CharKind = "code" | "string" | "comment";

/**
 * Labels each character of a config source as code, string literal or comment,
 * so braces and commas inside strings and comments are not mistaken for code.
 */
function classifyChars(source: string): CharKind[] {
  const kinds = new Array<CharKind>(source.length).fill("code");
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    let kind: CharKind;
    let end: number;
    if (char === "/" && next === "/") {
      kind = "comment";
      end = source.indexOf("\n", i);
      end = end === -1 ? source.length : end;
    } else if (char === "/" && next === "*") {
      kind = "comment";
      end = source.indexOf("*/", i + 2);
      end = end === -1 ? source.length : end + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      kind = "string";
      end = i + 1;
      while (end < source.length && source[end] !== char) {
        end += source[end] === "\\" ? 2 : 1;
      }
      end = Math.min(end + 1, source.length);
    } else {
      i++;
      continue;
    }
    kinds.fill(kind, i, end);
    i = end;
  }
  return kinds;
}

/**
 * The `{ ... }` object literal that encloses `index`, with comments blanked out,
 * or undefined when `index` is not inside one.
 */
function enclosingObjectLiteral(
  source: string,
  kinds: CharKind[],
  index: number
): string | undefined {
  const opens: number[] = [];
  let start: number | undefined;
  for (let i = 0; i < source.length; i++) {
    if (i === index) {
      start = opens.at(-1);
      if (start === undefined) {
        return undefined;
      }
    }
    if (kinds[i] !== "code") {
      continue;
    }
    if (source[i] === "{") {
      opens.push(i);
    } else if (source[i] === "}" && opens.pop() === start && start !== undefined) {
      let entry = "";
      for (let k = start; k <= i; k++) {
        entry += kinds[k] === "comment" ? " " : source[k];
      }
      return entry;
    }
  }
  return undefined;
}

/**
 * Adds the admin deploy arg to an existing scaffold verifier entry that predates
 * the verifier's `upgrade` entrypoint. Returns the source unchanged when the
 * entry already has deployArgs or is not the flat scaffold shape.
 */
function addVerifierAdminDeployArg(source: string): string {
  return source.replace(
    SCAFFOLD_VERIFIER_ENTRY,
    (match, open: string, indent: string, body: string, close: string) => {
      if (body.includes("deployArgs")) {
        return match;
      }
      // The comma goes after the last code character, never into a trailing
      // `// comment` (where it would leave the config without a separator).
      const kinds = classifyChars(body);
      let last = body.length - 1;
      while (last >= 0 && (kinds[last] === "comment" || /\s/.test(body[last]!))) {
        last--;
      }
      if (last < 0) {
        return match;
      }
      const separator = body[last] === "," ? "" : ",";
      const trailingComments = body.slice(last + 1).trimEnd();
      return `${open}${body.slice(0, last + 1)}${separator}${trailingComments}\n${indent}  ${ZK_VERIFIER_DEPLOY_ARGS}${close}`;
    }
  );
}

/**
 * True when an entry points at the scaffolded verifier but has no admin deploy
 * arg of its own, e.g. a nested or computed entry `addVerifierAdminDeployArg`
 * could not rewrite. Deploying that verifier fails without the constructor arg.
 * Another contract's `deployArgs: { admin }` does not count.
 */
function scaffoldVerifierLacksAdmin(source: string): boolean {
  const kinds = classifyChars(source);
  for (const match of source.matchAll(SCAFFOLD_VERIFIER_PATH)) {
    if (kinds[match.index] !== "code") {
      continue;
    }
    const entry = enclosingObjectLiteral(source, kinds, match.index);
    if (entry === undefined || !ADMIN_DEPLOY_ARG.test(entry)) {
      return true;
    }
  }
  return false;
}

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

  if (!needsVerifier) {
    next = addVerifierAdminDeployArg(next);
  }

  if (!needsVerifier && !needsZk) {
    return next === source ? { merged: source, changed: false } : { merged: next, changed: true };
  }

  if (needsVerifier) {
    const before = next;
    // Match contracts block closing at 2-space indent (not inner contract entries).
    // The first alternative matches an empty block, including the inline `contracts: {},`.
    next = next.replace(
      /contracts:\s*\{\s*\},|contracts:\s*\{([\s\S]*?)\n {2}\},/,
      (_match, entries: string | undefined) => {
        const body = (entries ?? "").trimEnd();
        // The last entry may lack a trailing comma (e.g. configs written by `ctg init --minimal`).
        const separator = body === "" || body.endsWith(",") ? "" : ",";
        return "contracts: {" + body + separator + "\n" + ZK_VERIFIER_BLOCK + "\n  },";
      }
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
  logger.info('       wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",');
  logger.info(`       ${ZK_VERIFIER_DEPLOY_ARGS}`);
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

export { mergeZkIntoConfigSource, scaffoldVerifierLacksAdmin };

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
