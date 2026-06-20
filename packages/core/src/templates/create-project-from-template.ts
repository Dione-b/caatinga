import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
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
  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    filter: (source) => shouldCopyTemplateEntry(templateDir, source, options.filter),
  });

  await replaceTemplateVariables(targetDir, options.projectName);
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

async function replaceTemplateVariables(dir: string, projectName: string): Promise<void> {
  const entries = await readdir(dir);

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        await replaceTemplateVariables(entryPath, projectName);
        return;
      }

      if (!isTextTemplateFile(entryPath)) {
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
