import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const BUNDLER_ENTRY = "./src/index.ts";
export const ROOT_BINDING_INDEX_CONTENT = 'export * from "./src/index.js";\n';

type BindingPackageJson = {
  main?: string;
  types?: string;
  exports?: Record<string, unknown>;
  [key: string]: unknown;
};

function resolveExportEntry(exportsField: Record<string, unknown> | undefined): string | undefined {
  if (!exportsField) {
    return undefined;
  }

  const rootExport = exportsField["."];
  if (typeof rootExport === "string") {
    return rootExport;
  }

  if (rootExport && typeof rootExport === "object" && !Array.isArray(rootExport)) {
    const conditions = rootExport as Record<string, unknown>;
    for (const key of ["import", "default", "types"]) {
      const value = conditions[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }

  return undefined;
}

function pointsToDist(main: string | undefined): boolean {
  return typeof main === "string" && main.replace(/^\.\//, "").startsWith("dist/");
}

function pointsToBundlerSource(entry: string | undefined): boolean {
  return entry === BUNDLER_ENTRY || entry === "./src/index.js";
}

function shouldPatchPackageJson(packageJson: BindingPackageJson): boolean {
  const exportEntry = resolveExportEntry(
    typeof packageJson.exports === "object" && packageJson.exports !== null && !Array.isArray(packageJson.exports)
      ? (packageJson.exports as Record<string, unknown>)
      : undefined
  );

  return (
    pointsToDist(packageJson.main) ||
    pointsToDist(packageJson.types) ||
    !pointsToBundlerSource(exportEntry)
  );
}

async function ensureRootBindingIndex(outputDir: string): Promise<void> {
  const rootIndexPath = path.join(outputDir, "index.ts");

  try {
    const existing = await readFile(rootIndexPath, "utf8");
    if (existing === ROOT_BINDING_INDEX_CONTENT) {
      return;
    }

    // Preserve a non-Caatinga root index if the generator starts shipping one.
    return;
  } catch {
    await writeFile(rootIndexPath, ROOT_BINDING_INDEX_CONTENT, "utf8");
  }
}

export async function patchGeneratedBindingPackage(outputDir: string): Promise<void> {
  const packageJsonPath = path.join(outputDir, "package.json");
  const entryPath = path.join(outputDir, "src", "index.ts");

  try {
    await access(entryPath);
  } catch {
    throw new CaatingaError(
      "Generated binding package is missing src/index.ts.",
      CaatingaErrorCode.BINDINGS_FAILED,
      "Re-run caatinga generate or check @stellar/stellar-sdk generate output."
    );
  }

  let raw: string;
  try {
    raw = await readFile(packageJsonPath, "utf8");
  } catch {
    throw new CaatingaError(
      "Generated binding package is missing package.json.",
      CaatingaErrorCode.BINDINGS_FAILED,
      "Re-run caatinga generate or check @stellar/stellar-sdk generate output."
    );
  }

  let packageJson: BindingPackageJson;
  try {
    packageJson = JSON.parse(raw) as BindingPackageJson;
  } catch {
    throw new CaatingaError(
      "Generated binding package.json is not valid JSON.",
      CaatingaErrorCode.BINDINGS_FAILED,
      "Re-run caatinga generate or check @stellar/stellar-sdk generate output."
    );
  }

  if (shouldPatchPackageJson(packageJson)) {
    packageJson.main = BUNDLER_ENTRY;
    packageJson.types = BUNDLER_ENTRY;
    packageJson.exports = {
      ...(typeof packageJson.exports === "object" && packageJson.exports !== null && !Array.isArray(packageJson.exports)
        ? packageJson.exports
        : {}),
      ".": BUNDLER_ENTRY,
    };

    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  }

  await ensureRootBindingIndex(outputDir);
}
