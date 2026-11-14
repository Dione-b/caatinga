import { readJsonFile, writeJsonFile } from "../artifacts/files.js";
import { zkArtifactPaths } from "../artifacts/zk-paths.js";

/**
 * Manifest written next to each proof so drift can be detected later. Records
 * the hash of the `input.json` the proof was produced from: without it,
 * `ctg status` cannot tell that the inputs moved on since the last prove.
 */
export type ProveManifest = {
  circuitName: string;
  inputHash: string;
  /**
   * Hash of the verification key the proof was produced against.
   *
   * Recorded because importing a ceremony replaces the VK while leaving a
   * previously generated proof in place. Without this, `ctg status` cannot tell
   * that `proof.json` belongs to a superseded key — the mismatch only shows up
   * as an on-chain verification failure with no visible cause.
   */
  vkHash: string;
  publicSignals: number;
  generatedAt: string;
};

export function proveManifestPath(artifactsDir: string): string {
  return zkArtifactPaths(artifactsDir).proveManifest;
}

export async function readProveManifest(artifactsDir: string): Promise<ProveManifest | null> {
  try {
    return await readJsonFile<ProveManifest>(proveManifestPath(artifactsDir));
  } catch {
    return null;
  }
}

export async function writeProveManifest(
  artifactsDir: string,
  manifest: ProveManifest
): Promise<void> {
  await writeJsonFile(proveManifestPath(artifactsDir), manifest);
}
