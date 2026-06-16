import { access } from "node:fs/promises";
import path from "node:path";
import { createJiti } from "jiti";
import { z } from "zod";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isDependenciesNotInstalledError } from "./is-dependencies-not-installed-error.js";
import { CaatingaConfigSchema, type CaatingaConfig } from "./config.schema.js";

export type LoadConfigOptions = {
  cwd?: string;
  configPath?: string;
};

export async function loadConfig(options: LoadConfigOptions = {}): Promise<CaatingaConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = path.resolve(cwd, options.configPath ?? "caatinga.config.ts");

  try {
    await access(configPath);
  } catch {
    throw new CaatingaError(
      "caatinga.config.ts was not found.",
      CaatingaErrorCode.CONFIG_NOT_FOUND,
      "Run this command from a Caatinga project root, or create a caatinga.config.ts file."
    );
  }

  try {
    const jiti = createJiti(import.meta.url);
    const loaded = await jiti.import(configPath, { default: true });
    return CaatingaConfigSchema.parse(loaded);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CaatingaError(
        "caatinga.config.ts is invalid.",
        CaatingaErrorCode.INVALID_CONFIG,
        error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      );
    }

    if (isDependenciesNotInstalledError(error)) {
      throw new CaatingaError(
        "Project dependencies are not installed.",
        CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED,
        "Run npm install (or pnpm install) in the project root, then retry.",
        error
      );
    }

    throw error;
  }
}
