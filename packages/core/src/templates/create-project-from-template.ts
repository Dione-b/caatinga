import { cp, lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import {
  TemplateManifestSchema,
  formatTemplateCompatibilityHint,
  formatTemplateCompatibilityMessage,
  getTemplateCompatibilityIssue,
  type TemplateManifest,
} from "./template-manifest.schema.js";

const TEMPLATE_COPY_EXCLUDED_DIRS = new Set(["target", "test_snapshots", "node_modules", ".git"]);

export type CreateProjectFromTemplateOptions = {
  projectName: string;
  targetDir: string;
  templateDir: string;
  filter?: (relativePath: string) => boolean;
};

export async function createProjectFromTemplate(options: CreateProjectFromTemplateOptions) {
  const targetDir = path.resolve(options.targetDir);
  const templateDir = path.resolve(options.templateDir);

  try {
    await stat(templateDir);
  } catch {
    throw new CaatingaError(
      `Template directory was not found: ${templateDir}`,
      CaatingaErrorCode.TEMPLATE_NOT_FOUND,
      "Use a bundled Caatinga template or set CAATINGA_TEMPLATES_DIR for local development."
    );
  }

  const manifest = await readTemplateManifest(templateDir);

  const mergeIntoExisting = Boolean(options.filter);
  // #90: in merge mode, record exactly which relative paths the copy writes so
  // variable substitution never touches a user's pre-existing files.
  const copiedRelPaths = mergeIntoExisting ? new Set<string>() : undefined;
  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    filter: (source) => {
      const keep = shouldCopyTemplateEntry(templateDir, source, options.filter);
      if (keep && copiedRelPaths) {
        const rel = path.relative(templateDir, source);
        if (rel) {
          copiedRelPaths.add(rel);
        }
      }
      return keep;
    },
  });

  await replaceTemplateVariables(targetDir, options.projectName, copiedRelPaths);
  if (!mergeIntoExisting) {
    await ensureArtifacts(targetDir, options.projectName);
  }

  return { targetDir, template: manifest };
}

async function ensureArtifacts(targetDir: string, projectName: string): Promise<void> {
  try {
    const artifacts = await readArtifacts(targetDir);
    await writeArtifacts({ ...artifacts, project: projectName }, targetDir);
  } catch (error) {
    if (error instanceof CaatingaError && error.code === CaatingaErrorCode.ARTIFACT_NOT_FOUND) {
      await writeArtifacts(
        createInitialArtifacts(projectName, { networks: ["testnet"] }),
        targetDir
      );
      return;
    }

    throw error;
  }
}

async function readTemplateManifest(templateDir: string): Promise<TemplateManifest> {
  const manifestPath = path.join(templateDir, "caatinga.template.json");

  try {
    const rawManifest = await readFile(manifestPath, "utf8");
    const manifest = TemplateManifestSchema.parse(JSON.parse(rawManifest));

    const compatibilityIssue = getTemplateCompatibilityIssue(manifest);
    if (compatibilityIssue) {
      throw new CaatingaError(
        formatTemplateCompatibilityMessage(compatibilityIssue),
        CaatingaErrorCode.TEMPLATE_INCOMPATIBLE,
        formatTemplateCompatibilityHint(compatibilityIssue)
      );
    }

    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CaatingaError(
        "Template manifest was not found.",
        CaatingaErrorCode.TEMPLATE_MANIFEST_NOT_FOUND,
        "Add a caatinga.template.json file to the template root."
      );
    }

    if (error instanceof CaatingaError) {
      throw error;
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new CaatingaError(
        "Template manifest is invalid.",
        CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST,
        "Fix caatinga.template.json so it is valid JSON and matches the template manifest schema."
      );
    }

    throw error;
  }
}

async function replaceTemplateVariables(
  dir: string,
  projectName: string,
  allowlist?: ReadonlySet<string>,
  rootDir: string = dir
): Promise<void> {
  const entries = await readdir(dir);

  await Promise.all(
    entries.map(async (entry) => {
      // Skip the same directories the copy step excludes. When merging into an
      // existing project the walk root is the project itself, so descending into
      // node_modules/target/.git could follow an unrelated (possibly broken)
      // symlink and crash the command with ENOENT.
      if (TEMPLATE_COPY_EXCLUDED_DIRS.has(entry)) {
        return;
      }

      const entryPath = path.join(dir, entry);
      // Use lstat so symlinks are never dereferenced: a dangling link must not
      // be followed (that is what throws ENOENT) and is not a substitution target.
      const entryStat = await lstat(entryPath);

      if (entryStat.isSymbolicLink()) {
        return;
      }

      if (entryStat.isDirectory()) {
        await replaceTemplateVariables(entryPath, projectName, allowlist, rootDir);
        return;
      }

      if (!entryStat.isFile() || !isTextTemplateFile(entryPath)) {
        return;
      }

      // #90: in merge mode, only substitute in files the template actually
      // copied — never in a user's pre-existing files.
      if (allowlist && !allowlist.has(path.relative(rootDir, entryPath))) {
        return;
      }

      const content = await readFile(entryPath, "utf8");
      await writeFile(entryPath, content.replaceAll("__PROJECT_NAME__", projectName), "utf8");
    })
  );
}

function shouldCopyTemplateEntry(
  templateDir: string,
  source: string,
  userFilter?: (relativePath: string) => boolean
): boolean {
  const relativePath = path.relative(templateDir, source);
  if (!relativePath || relativePath === ".") {
    return true;
  }

  const normalizedPath = relativePath.split(path.sep).join("/");
  if (userFilter && !userFilter(normalizedPath)) {
    return false;
  }

  return !relativePath.split(path.sep).some((segment) => TEMPLATE_COPY_EXCLUDED_DIRS.has(segment));
}

function isTextTemplateFile(filePath: string): boolean {
  return [".json", ".md", ".rs", ".toml", ".ts", ".tsx", ".css", ".html"].includes(
    path.extname(filePath)
  );
}
