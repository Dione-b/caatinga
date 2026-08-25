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

const MISSING_WASM_TARGET_HINT_SUBSTRINGS = [
  "not installed",
  "not found",
  "needs to be installed",
  "add the",
  "rustup target",
] as const;

/**
 * Heuristic: does this build failure mean the Rust wasm target is missing?
 * Matched against the merged message/hint/cause text, so it stays a single
 * definition shared by the single-contract and workspace build paths.
 */
export function isMissingRustWasmTargetError(error: unknown): boolean {
  if (!(error instanceof CaatingaError)) {
    return false;
  }

  const parts = [
    error.message,
    error.hint ?? "",
    error.cause === undefined ? "" : String(error.cause),
  ];
  const haystack = parts.join("\n").toLowerCase();

  if (!haystack.includes(CURRENT_RUST_WASM_TARGET)) {
    return false;
  }

  return MISSING_WASM_TARGET_HINT_SUBSTRINGS.some((needle) => haystack.includes(needle));
}

export type ResolveWasmArtifactPathOptions = {
  sourcePath?: string;
};

function wasmNotFoundError(
  configuredWasmPath: string,
  options?: { migratedPath?: string }
): CaatingaError {
  const migratedPath = options?.migratedPath;
  const cargoTargetDir = process.env.CARGO_TARGET_DIR;
  const hintParts = ["Run ctg build before deploy or generate."];

  if (migratedPath !== undefined) {
    hintParts.push(
      `Soroban builds use the "${CURRENT_RUST_WASM_TARGET}" target.`,
      `Update wasm in caatinga.config.ts to "${toConfigRelativeWasmPath(migratedPath)}" or an equivalent path under target/${CURRENT_RUST_WASM_TARGET}/release/.`
    );
  }

  if (cargoTargetDir) {
    hintParts.push(
      `CARGO_TARGET_DIR is set to "${cargoTargetDir}"; the WASM may be under that directory instead of the configured path. Unset CARGO_TARGET_DIR or update wasm in caatinga.config.ts.`
    );
  }

  return new CaatingaError(
    `WASM output was not found at ${configuredWasmPath}.`,
    CaatingaErrorCode.ARTIFACT_NOT_FOUND,
    hintParts.join(" ")
  );
}

function toConfigRelativeWasmPath(absoluteWasmPath: string): string {
  const relative = path.relative(process.cwd(), absoluteWasmPath);
  return relative.startsWith("..") ? absoluteWasmPath : `./${relative.split(path.sep).join("/")}`;
}

function wasmFileName(configuredWasmPath: string): string {
  return path.basename(configuredWasmPath);
}

function buildAlternateWasmCandidates(
  configuredWasmPath: string,
  options?: ResolveWasmArtifactPathOptions
): string[] {
  const fileName = wasmFileName(configuredWasmPath);
  const candidates: string[] = [];
  const seen = new Set<string>();

  function addCandidate(candidate: string): void {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      return;
    }
    seen.add(resolved);
    candidates.push(resolved);
  }

  const cargoTargetDir = process.env.CARGO_TARGET_DIR;
  if (cargoTargetDir) {
    addCandidate(path.join(cargoTargetDir, CURRENT_RUST_WASM_TARGET, "release", fileName));
    addCandidate(path.join(cargoTargetDir, LEGACY_RUST_WASM_TARGET, "release", fileName));
  }

  if (options?.sourcePath) {
    addCandidate(
      path.join(options.sourcePath, "target", CURRENT_RUST_WASM_TARGET, "release", fileName)
    );
    addCandidate(
      path.join(options.sourcePath, "target", LEGACY_RUST_WASM_TARGET, "release", fileName)
    );
  }

  return candidates;
}

async function firstExistingPath(paths: string[]): Promise<string | undefined> {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

export async function resolveWasmArtifactPath(
  configuredWasmPath: string,
  options?: ResolveWasmArtifactPathOptions
): Promise<string> {
  const resolvedConfiguredPath = path.resolve(configuredWasmPath);

  try {
    await access(resolvedConfiguredPath);
    return resolvedConfiguredPath;
  } catch {
    const currentTargetPath = toCurrentWasmTargetPath(resolvedConfiguredPath);
    if (currentTargetPath !== resolvedConfiguredPath) {
      const migratedPath = await firstExistingPath([currentTargetPath]);
      if (migratedPath) {
        return migratedPath;
      }
    }

    const alternatePath = await firstExistingPath(
      buildAlternateWasmCandidates(resolvedConfiguredPath, options)
    );
    if (alternatePath) {
      return alternatePath;
    }

    throw wasmNotFoundError(resolvedConfiguredPath, {
      migratedPath: currentTargetPath !== resolvedConfiguredPath ? currentTargetPath : undefined,
    });
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
    "Run `ctg build` before deploy."
  );
}
