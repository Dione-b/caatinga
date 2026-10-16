import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { ZkError } from "../errors/ZkError.js";

/**
 * Roles of the files an imported ceremony is pinned to. Paths are stored
 * relative to the circuit's artifacts directory so a project can move without
 * invalidating its manifest.
 */
export type CeremonyArtifactRole = "zkey" | "verificationKey" | "ptau" | "r1cs" | "wasm";

export type CeremonyArtifactDigest = {
  /** Path relative to `.artifacts/zk/<circuit>`. */
  path: string;
  sha256: string;
};

export type CeremonyArtifactDigests = Partial<
  Record<CeremonyArtifactRole, CeremonyArtifactDigest>
> & {
  zkey: CeremonyArtifactDigest;
  verificationKey: CeremonyArtifactDigest;
};

/**
 * Where an imported ceremony came from. Recorded for auditors; Caatinga does not
 * fetch or trust any of it — the hashes are what get enforced.
 */
export type CeremonyProvenance = {
  sourceUrl?: string;
  /** Human-readable ceremony name, e.g. "acme-multiplier-2026". */
  ceremony?: string;
  participants?: number;
  /** ISO timestamp of when the artifacts were retrieved from `sourceUrl`. */
  retrievedAt: string;
  curve: "bls12381";
};

/**
 * Artifacts whose bytes decide what the on-chain verifier accepts. A mismatch on
 * any of these blocks mainnet deploy/invoke. `r1cs` and `wasm` are recompiled by
 * `ctg zk build`, so they are recorded for audit and only reported by
 * `ctg zk verify-ceremony`.
 */
export const CRITICAL_CEREMONY_ARTIFACTS: readonly CeremonyArtifactRole[] = [
  "zkey",
  "verificationKey",
  "ptau",
];

export type CeremonyArtifactMismatch = {
  role: CeremonyArtifactRole;
  path: string;
  expected: string;
  /** `undefined` when the file is missing. */
  actual?: string;
  critical: boolean;
};

/** Streaming sha256 of a file's raw bytes (zkeys can be hundreds of MB). */
export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

async function fileExists(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

/**
 * Hashes each artifact that exists. `zkey` and `verificationKey` are required:
 * a ceremony without them is not one Caatinga can pin.
 */
export async function digestCeremonyArtifacts(
  artifactsDir: string,
  paths: Partial<Record<CeremonyArtifactRole, string>> & { zkey: string; verificationKey: string }
): Promise<CeremonyArtifactDigests> {
  const digests: Partial<Record<CeremonyArtifactRole, CeremonyArtifactDigest>> = {};

  for (const [role, relativePath] of Object.entries(paths) as [CeremonyArtifactRole, string][]) {
    const absolute = path.join(artifactsDir, relativePath);
    if (!(await fileExists(absolute))) {
      if (role === "zkey" || role === "verificationKey") {
        throw new ZkError(
          `Cannot pin the ceremony: ${absolute} does not exist.`,
          "ZK_CEREMONY_INCOMPATIBLE",
          "Re-run `ctg zk import-ceremony` with the ceremony output directory."
        );
      }
      continue;
    }
    digests[role] = { path: relativePath, sha256: await sha256File(absolute) };
  }

  return digests as CeremonyArtifactDigests;
}

/** Re-hashes every recorded artifact and lists the ones that no longer match. */
export async function findCeremonyMismatches(
  artifactsDir: string,
  recorded: CeremonyArtifactDigests
): Promise<CeremonyArtifactMismatch[]> {
  const mismatches: CeremonyArtifactMismatch[] = [];

  for (const [role, digest] of Object.entries(recorded) as [
    CeremonyArtifactRole,
    CeremonyArtifactDigest | undefined,
  ][]) {
    if (!digest) {
      continue;
    }
    const absolute = path.join(artifactsDir, digest.path);
    const actual = (await fileExists(absolute)) ? await sha256File(absolute) : undefined;
    if (actual !== digest.sha256) {
      mismatches.push({
        role,
        path: digest.path,
        expected: digest.sha256,
        actual,
        critical: CRITICAL_CEREMONY_ARTIFACTS.includes(role),
      });
    }
  }

  return mismatches;
}

/**
 * Throws `ZK_CEREMONY_TAMPERED` unless the critical artifacts still match the
 * hashes recorded at import. Cheap (hashing only, no snarkjs) so it can run on
 * every mainnet deploy and invoke.
 *
 * A manifest without recorded hashes is rejected too: otherwise editing
 * `ceremony.json` to say `mpc-multi-party` would be enough to lift the mainnet
 * dev-ceremony block.
 */
export async function assertCeremonyIntegrity(options: {
  artifactsDir: string;
  artifacts?: CeremonyArtifactDigests;
  operation: string;
}): Promise<void> {
  if (!options.artifacts) {
    throw new ZkError(
      `${options.operation} is blocked on mainnet: the MPC ceremony manifest in ${options.artifactsDir} records no artifact hashes.`,
      "ZK_CEREMONY_TAMPERED",
      "Re-import the ceremony with `ctg zk import-ceremony` so its artifacts are pinned, then run `ctg zk verify-ceremony`."
    );
  }

  const critical = (await findCeremonyMismatches(options.artifactsDir, options.artifacts)).filter(
    (mismatch) => mismatch.critical
  );
  if (critical.length === 0) {
    return;
  }

  const details = critical
    .map((mismatch) =>
      mismatch.actual === undefined
        ? `${mismatch.path} is missing`
        : `${mismatch.path} sha256 ${mismatch.actual} (expected ${mismatch.expected})`
    )
    .join("; ");

  throw new ZkError(
    `${options.operation} is blocked: ceremony artifacts changed since import (${details}).`,
    "ZK_CEREMONY_TAMPERED",
    "Restore the original ceremony files, or re-import them with `ctg zk import-ceremony` after auditing where the change came from."
  );
}
