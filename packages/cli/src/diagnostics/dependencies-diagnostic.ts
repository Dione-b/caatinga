import { access } from "node:fs/promises";
import path from "node:path";
import type { Diagnostic } from "./types.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function dependenciesDiagnostic(cwd = process.cwd()): Promise<Diagnostic | undefined> {
  const packageJsonPath = path.join(cwd, "package.json");
  const configPath = path.join(cwd, "caatinga.config.ts");
  const coreModulePath = path.join(cwd, "node_modules", "@caatinga", "core");

  const hasPackageJson = await exists(packageJsonPath);
  const hasConfig = await exists(configPath);

  if (!hasPackageJson && !hasConfig) {
    return undefined;
  }

  const hasCoreInstalled = await exists(coreModulePath);
  if (hasCoreInstalled) {
    return { ok: true, label: "Project dependencies installed" };
  }

  if (hasConfig || hasPackageJson) {
    return {
      ok: false,
      label: "Project dependencies not installed",
      fix: "Run npm install (or pnpm install) in the project root.",
    };
  }

  return undefined;
}
