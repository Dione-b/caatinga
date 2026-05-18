import { createHash } from "node:crypto";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

export async function assertWasmExists(wasmPath: string): Promise<void> {
  try {
    await access(wasmPath);
  } catch {
    throw new CaatingaError(
      `WASM output was not found at ${wasmPath}.`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run caatinga build before deploy or generate."
    );
  }
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
