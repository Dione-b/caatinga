import { runCommand } from "@caatinga/core";
import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { hashFileContents, readJsonFile } from "../artifacts/files.js";
import { zkArtifactPaths } from "../artifacts/zk-paths.js";
import { ensureSnarkjs } from "../install/lazy-install-zk-tools.js";
import type { ZkInstallProgress } from "../install/install-progress.js";
import { toZkInputError } from "./input-errors.js";
import { writeProveManifest } from "./prove-manifest.js";

export type ProveCircuitOptions = {
  circuitName: string;
  circuitPath: string;
  artifactsDir: string;
  inputPath: string;
  debug: boolean;
  progress?: ZkInstallProgress;
};

export function resolveCircuitWasmPath(artifactsDir: string): string {
  return zkArtifactPaths(artifactsDir).wasm;
}

export async function proveCircuit(options: ProveCircuitOptions): Promise<void> {
  const snarkjs = await ensureSnarkjs(options.progress);
  const artifacts = zkArtifactPaths(path.resolve(options.artifactsDir));
  const inputPath = path.resolve(options.inputPath);

  await mkdir(artifacts.dir, { recursive: true });

  try {
    if (options.debug) {
      await runCommand(snarkjs, [
        "wtns",
        "calculate",
        artifacts.wasm,
        inputPath,
        artifacts.witness,
        "-v",
      ]);
      await runCommand(snarkjs, [
        "groth16",
        "prove",
        artifacts.zkey,
        artifacts.witness,
        artifacts.proof,
        artifacts.publicSignals,
      ]);
    } else {
      await runCommand(snarkjs, [
        "groth16",
        "fullprove",
        inputPath,
        artifacts.wasm,
        artifacts.zkey,
        artifacts.proof,
        artifacts.publicSignals,
      ]);
    }
  } catch (error) {
    // Only input-shaped failures are re-mapped; anything else propagates
    // unchanged so the underlying command error stays the reported cause.
    throw toZkInputError(error, inputPath);
  }

  await access(artifacts.proof);
  await access(artifacts.publicSignals);

  const publicSignals = await readPublicSignalsCount(artifacts.publicSignals);
  await writeProveManifest(artifacts.dir, {
    circuitName: options.circuitName,
    inputHash: await hashFileContents(inputPath),
    vkHash: await hashFileContents(artifacts.verificationKey),
    publicSignals,
    generatedAt: new Date().toISOString(),
  });
}

async function readPublicSignalsCount(publicPath: string): Promise<number> {
  try {
    const raw = await readJsonFile<unknown>(publicPath);
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}
