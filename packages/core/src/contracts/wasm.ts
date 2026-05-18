import { createHash } from "node:crypto";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

export const LEGACY_RUST_WASM_TARGET = "wasm32-unknown-unknown";
export const CURRENT_RUST_WASM_TARGET = "wasm32v1-none";

export function toCurrentWasmTargetPath(wasmPath: string): string {
  if (!wasmPath.includes(LEGACY_RUST_WASM_TARGET)) {
    return wasmPath;
  }

  return wasmPath.replaceAll(LEGACY_RUST_WASM_TARGET, CURRENT_RUST_WASM_TARGET);
}

function wasmNotFoundError(
  configuredWasmPath: string,
  options?: { migratedPath?: string }
): CaatingaError {
  const migratedPath = options?.migratedPath;
  const hint =
    migratedPath === undefined
      ? "Run caatinga build before deploy or generate."
      : [
          "Run caatinga build before deploy or generate.",
          `Soroban builds use the "${CURRENT_RUST_WASM_TARGET}" target.`,
          `Update wasm in caatinga.config.ts to "${toConfigRelativeWasmPath(migratedPath)}" or an equivalent path under target/${CURRENT_RUST_WASM_TARGET}/release/.`
        ].join(" ");

  return new CaatingaError(
    `WASM output was not found at ${configuredWasmPath}.`,
    CaatingaErrorCode.ARTIFACT_NOT_FOUND,
    hint
  );
}

function toConfigRelativeWasmPath(absoluteWasmPath: string): string {
  const relative = path.relative(process.cwd(), absoluteWasmPath);
  return relative.startsWith("..") ? absoluteWasmPath : `./${relative.split(path.sep).join("/")}`;
}

export async function resolveWasmArtifactPath(configuredWasmPath: string): Promise<string> {
  try {
    await access(configuredWasmPath);
    return configuredWasmPath;
  } catch {
    const currentTargetPath = toCurrentWasmTargetPath(configuredWasmPath);
    if (currentTargetPath === configuredWasmPath) {
      throw wasmNotFoundError(configuredWasmPath);
    }

    try {
      await access(currentTargetPath);
      return currentTargetPath;
    } catch {
      throw wasmNotFoundError(configuredWasmPath, { migratedPath: currentTargetPath });
    }
  }
}

export async function assertWasmExists(wasmPath: string): Promise<void> {
  await resolveWasmArtifactPath(wasmPath);
}

export async function hashWasm(wasmPath: string): Promise<string> {
  const bytes = await readFile(wasmPath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function getNewestMtimeInDirectory(directory: string): Promise<number | undefined> {
  try {
    await access(directory);
  } catch {
    return undefined;
  }

  let newest = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const fileStat = await stat(entryPath);
      newest = Math.max(newest, fileStat.mtimeMs);
    }
  }

  await walk(directory);
  return newest > 0 ? newest : undefined;
}

/** Best-effort: true when any file under `<contractPath>/src` is newer than the WASM. */
export async function isWasmOlderThanSources(input: {
  wasmPath: string;
  contractPath: string;
}): Promise<boolean> {
  const srcDir = path.join(input.contractPath, "src");
  const newestSourceMtime = await getNewestMtimeInDirectory(srcDir);
  if (newestSourceMtime === undefined) {
    return false;
  }

  let wasmStat;
  try {
    wasmStat = await stat(input.wasmPath);
  } catch {
    return false;
  }

  return wasmStat.mtimeMs < newestSourceMtime;
}

export function formatStaleWasmWarning(contractName: string): string {
  return (
    `WASM for "${contractName}" may be stale: contract sources under src/ are newer than the WASM file. ` +
    "Run `caatinga build` before deploy."
  );
}
