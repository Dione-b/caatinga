import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runCommand } from "@caatinga/core";
import { ZkError } from "../errors/ZkError.js";
import { ensureSnarkjs } from "../install/lazy-install-zk-tools.js";
import type { ZkInstallProgress } from "../install/install-progress.js";
import { findCeremonyMismatches, type CeremonyArtifactMismatch } from "./ceremony-integrity.js";
import {
  ceremonyManifestPath,
  MPC_CEREMONY_TYPE,
  readCeremonyManifest,
  writeMpcCeremonyManifest,
  type MpcCeremonyManifest,
} from "./dev-ceremony.js";

export type VerifyCeremonyOptions = {
  artifactsDir: string;
  progress?: ZkInstallProgress;
};

export type VerifyCeremonyResult = {
  manifest: MpcCeremonyManifest;
  /** Artifacts that no longer match their recorded hashes. */
  mismatches: CeremonyArtifactMismatch[];
  /**
   * `snarkjs zkey verify` outcome: `"verified"`, or `"skipped"` when the
   * ceremony shipped no powers-of-tau to verify against.
   */
  zkey: "verified" | "skipped";
  /** Whether `verification_key.json` equals the key exported from the zkey. */
  verificationKeyMatchesZkey: boolean;
};

const ZKEY_OK_PATTERN = /ZKey Ok!/;

/**
 * Offline, reproducible check of an imported ceremony:
 *
 * 1. re-hashes every artifact recorded in `ceremony.json`;
 * 2. runs `snarkjs zkey verify <r1cs> <ptau> <zkey>` when a ptau was imported,
 *    proving the proving key derives from that circuit and powers-of-tau;
 * 3. exports the verification key from the zkey and compares it with the
 *    `verification_key.json` the verifier is fed.
 *
 * Throws `ZK_CEREMONY_TAMPERED` when a critical artifact changed, the zkey does
 * not verify, or the verification key does not belong to the zkey. On success
 * it stamps `verifiedAt` in the manifest. Nothing here touches the network.
 */
export async function verifyCeremony(
  options: VerifyCeremonyOptions
): Promise<VerifyCeremonyResult> {
  const artifactsDir = path.resolve(options.artifactsDir);
  const manifest = await readCeremonyManifest(artifactsDir);

  if (manifest?.type !== MPC_CEREMONY_TYPE) {
    throw new ZkError(
      `No imported MPC ceremony found in ${ceremonyManifestPath(artifactsDir)}.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "Import one with `ctg zk import-ceremony <circuit> --ceremony <path>`; dev ceremonies have nothing to verify against."
    );
  }

  if (!manifest.artifacts) {
    throw new ZkError(
      `The ceremony manifest in ${artifactsDir} records no artifact hashes.`,
      "ZK_CEREMONY_TAMPERED",
      "Re-import the ceremony with `ctg zk import-ceremony` so its artifacts are pinned."
    );
  }

  const mismatches = await findCeremonyMismatches(artifactsDir, manifest.artifacts);
  const critical = mismatches.filter((mismatch) => mismatch.critical);
  if (critical.length > 0) {
    throw new ZkError(
      `Ceremony artifacts changed since import: ${critical.map((mismatch) => mismatch.path).join(", ")}.`,
      "ZK_CEREMONY_TAMPERED",
      "Restore the original ceremony files, or re-import them with `ctg zk import-ceremony` after auditing where the change came from."
    );
  }

  const snarkjs = await ensureSnarkjs(options.progress);
  const zkeyPath = path.join(artifactsDir, manifest.artifacts.zkey.path);
  const r1csPath = path.join(artifactsDir, manifest.artifacts.r1cs?.path ?? "main.r1cs");

  let zkey: VerifyCeremonyResult["zkey"] = "skipped";
  if (manifest.artifacts.ptau) {
    const ptauPath = path.join(artifactsDir, manifest.artifacts.ptau.path);
    options.progress?.onStatus?.("Running snarkjs zkey verify (this can take a while)...");
    let output = "";
    try {
      output = (await runCommand(snarkjs, ["zkey", "verify", r1csPath, ptauPath, zkeyPath])).all;
    } catch (error) {
      output = error instanceof Error ? error.message : String(error);
    }
    if (!ZKEY_OK_PATTERN.test(output)) {
      throw new ZkError(
        `snarkjs zkey verify rejected ${zkeyPath} against ${path.basename(ptauPath)} and the compiled circuit.`,
        "ZK_CEREMONY_TAMPERED",
        "The proving key does not derive from this circuit and powers-of-tau. Obtain the ceremony's published artifacts again and re-import them."
      );
    }
    zkey = "verified";
  }

  const exportDir = await mkdtemp(path.join(tmpdir(), "caatinga-zk-vk-"));
  let verificationKeyMatchesZkey: boolean;
  try {
    const exported = path.join(exportDir, "verification_key.json");
    await runCommand(snarkjs, ["zkey", "export", "verificationkey", zkeyPath, exported]);
    const recorded = JSON.parse(
      await readFile(path.join(artifactsDir, manifest.artifacts.verificationKey.path), "utf8")
    ) as unknown;
    verificationKeyMatchesZkey = isDeepStrictEqual(
      JSON.parse(await readFile(exported, "utf8")),
      recorded
    );
  } finally {
    await rm(exportDir, { recursive: true, force: true });
  }

  if (!verificationKeyMatchesZkey) {
    throw new ZkError(
      `${manifest.artifacts.verificationKey.path} is not the verification key of ${manifest.artifacts.zkey.path}.`,
      "ZK_CEREMONY_TAMPERED",
      "Export it from the ceremony zkey (`snarkjs zkey export verificationkey`) or re-import the ceremony output."
    );
  }

  const { type: _type, ...rest } = manifest;
  await writeMpcCeremonyManifest(artifactsDir, {
    ...rest,
    verifiedAt: new Date().toISOString(),
  });

  return { manifest, mismatches, zkey, verificationKeyMatchesZkey };
}
