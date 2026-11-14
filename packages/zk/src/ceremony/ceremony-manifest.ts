import { readJsonFile, writeJsonFile } from "../artifacts/files.js";
import { zkArtifactPaths } from "../artifacts/zk-paths.js";
import type { CeremonyArtifactDigests, CeremonyProvenance } from "./ceremony-integrity.js";

export const DEV_CEREMONY_TYPE = "dev-single-party" as const;
export const MPC_CEREMONY_TYPE = "mpc-multi-party" as const;
/** Version of the MPC manifest shape written by `ctg zk import-ceremony`. */
export const MPC_CEREMONY_MANIFEST_VERSION = 2 as const;

export type DevCeremonyManifest = {
  type: typeof DEV_CEREMONY_TYPE;
  generatedAt: string;
};

/**
 * Manifest written in place of the dev manifest once audited MPC ceremony
 * artifacts have been imported. The `circuitHash` is what lets `ctg zk build`
 * refuse to silently mix MPC artifacts with a circuit that has since changed —
 * a VK from a different circuit fails on-chain with CAATINGA_ZK_VERIFICATION_FAILED
 * and no indication of the real cause.
 */
export type MpcCeremonyManifest = {
  type: typeof MPC_CEREMONY_TYPE;
  generatedAt: string;
  /** sha256 of the circuit sources this ceremony was run against. */
  circuitHash: string;
  /** Number of public signals the circuit declares (`ic.length - 1`). */
  publicSignals: number;
  /** Path the artifacts were imported from, kept for auditability. */
  source?: string;
  /**
   * Manifest shape version. Absent on manifests written before artifact hashes
   * were recorded; those are rejected on mainnet until re-imported.
   */
  version?: typeof MPC_CEREMONY_MANIFEST_VERSION;
  /** sha256 of each imported artifact, enforced on mainnet deploy/invoke. */
  artifacts?: CeremonyArtifactDigests;
  provenance?: CeremonyProvenance;
  /** Set by `ctg zk verify-ceremony` after `snarkjs zkey verify` succeeds. */
  verifiedAt?: string;
};

export type CeremonyManifest = DevCeremonyManifest | MpcCeremonyManifest;

export function ceremonyManifestPath(artifactsDir: string): string {
  return zkArtifactPaths(artifactsDir).ceremonyManifest;
}

export async function writeDevCeremonyManifest(artifactsDir: string): Promise<void> {
  const manifest: DevCeremonyManifest = {
    type: DEV_CEREMONY_TYPE,
    generatedAt: new Date().toISOString(),
  };
  await writeJsonFile(ceremonyManifestPath(artifactsDir), manifest);
}

export async function writeMpcCeremonyManifest(
  artifactsDir: string,
  manifest: Omit<MpcCeremonyManifest, "type" | "generatedAt"> & { generatedAt?: string }
): Promise<void> {
  const full: MpcCeremonyManifest = {
    ...manifest,
    type: MPC_CEREMONY_TYPE,
    generatedAt: manifest.generatedAt ?? new Date().toISOString(),
  };
  await writeJsonFile(ceremonyManifestPath(artifactsDir), full);
}

/**
 * Reads whichever ceremony manifest an artifacts directory carries. Returns
 * `null` when there is none, or when it does not parse / uses an unrecognised
 * type — an unknown manifest is treated as "no ceremony recorded" rather than
 * blocking the operation, so a hand-edited manifest cannot wedge a deploy.
 */
export async function readCeremonyManifest(artifactsDir: string): Promise<CeremonyManifest | null> {
  try {
    const parsed = await readJsonFile<Partial<CeremonyManifest>>(
      ceremonyManifestPath(artifactsDir)
    );
    if (parsed.type === DEV_CEREMONY_TYPE || parsed.type === MPC_CEREMONY_TYPE) {
      return parsed as CeremonyManifest;
    }
    return null;
  } catch {
    return null;
  }
}

export async function readDevCeremonyManifest(
  artifactsDir: string
): Promise<DevCeremonyManifest | null> {
  const manifest = await readCeremonyManifest(artifactsDir);
  return manifest?.type === DEV_CEREMONY_TYPE ? manifest : null;
}
