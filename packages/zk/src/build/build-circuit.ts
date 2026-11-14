import { runCommand } from "@caatinga/core";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { CIRCUIT_ENTRY_FILE, zkArtifactPaths } from "../artifacts/zk-paths.js";
import { assertCeremonyMatchesCircuit } from "../ceremony/ceremony-guards.js";
import {
  MPC_CEREMONY_TYPE,
  readCeremonyManifest,
  writeDevCeremonyManifest,
} from "../ceremony/ceremony-manifest.js";
import { devContributionInput } from "../install/dev-contribution.js";
import type { ZkInstallProgress } from "../install/install-progress.js";
import { ensureCircom, ensurePtau, ensureSnarkjs } from "../install/lazy-install-zk-tools.js";
import { hashCircuitSources } from "./circuit-sources.js";
import { ptauSizeForConstraints } from "./detect-ptau-size.js";
import { writeEmbeddedVk } from "./embedded-vk.js";
import { readR1csInfo } from "./r1cs-info.js";

export type BuildCircuitOptions = {
  circuitName: string;
  circuitPath: string;
  artifactsDir: string;
  embedVk: boolean;
  progress?: ZkInstallProgress;
};

export async function buildCircuit(options: BuildCircuitOptions): Promise<void> {
  const progress = options.progress;
  const circom = await ensureCircom(progress);
  const circuitDir = path.resolve(options.circuitPath);
  const artifacts = zkArtifactPaths(path.resolve(options.artifactsDir));
  const circuitFile = path.join(circuitDir, CIRCUIT_ENTRY_FILE);

  await mkdir(artifacts.dir, { recursive: true });

  progress?.onStatus?.(`Compiling ${circuitFile}...`);
  await runCommand(circom, [
    circuitFile,
    "--r1cs",
    "--wasm",
    "--sym",
    "-p",
    "bls12381",
    "-o",
    artifacts.dir,
  ]);

  const circuitHash = await hashCircuitSources(circuitDir);

  // Audited ceremony artifacts already present? Reuse them — a re-run must not
  // overwrite an MPC proving key with a dev one, which would silently demote a
  // production build back to an untrusted dev ceremony.
  const existingCeremony = await readCeremonyManifest(artifacts.dir);
  const reusesMpcCeremony = existingCeremony?.type === MPC_CEREMONY_TYPE;
  if (reusesMpcCeremony) {
    await assertCeremonyMatchesCircuit(artifacts.dir, circuitHash);
  } else {
    await runDevTrustedSetup(artifacts, progress);
  }

  if (options.embedVk) {
    await writeEmbeddedVk(artifacts.verificationKey);
  }

  if (reusesMpcCeremony) {
    progress?.onStatus?.("Reusing imported MPC ceremony artifacts (skipping dev trusted setup).");
  } else {
    await writeDevCeremonyManifest(artifacts.dir);
  }
}

/**
 * Single-party Groth16 setup: a fresh proving key and the verification key
 * exported from it. Every run produces new keys, so proofs made with the
 * previous ones stop verifying.
 */
async function runDevTrustedSetup(
  artifacts: ReturnType<typeof zkArtifactPaths>,
  progress?: ZkInstallProgress
): Promise<void> {
  const snarkjs = await ensureSnarkjs(progress);

  const { constraints } = await readR1csInfo(snarkjs, artifacts.r1cs);
  const ptauPath = await ensurePtau(ptauSizeForConstraints(constraints ?? 1), progress);

  progress?.onStatus?.("Running Groth16 trusted setup...");
  await runCommand(snarkjs, ["groth16", "setup", artifacts.r1cs, ptauPath, artifacts.initialZkey]);
  await runCommand(snarkjs, ["zkey", "contribute", artifacts.initialZkey, artifacts.zkey, "-v"], {
    input: devContributionInput(),
  });
  await runCommand(snarkjs, [
    "zkey",
    "export",
    "verificationkey",
    artifacts.zkey,
    artifacts.verificationKey,
  ]);
}
