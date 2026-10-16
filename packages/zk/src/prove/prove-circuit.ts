import { runCommand } from "@caatinga/core";
import path from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ensureSnarkjs } from "../install/lazy-install-zk-tools.js";
import type { ZkInstallProgress } from "../install/install-progress.js";
import { toZkInputError } from "./input-errors.js";

export type ProveCircuitOptions = {
  circuitName: string;
  circuitPath: string;
  artifactsDir: string;
  inputPath: string;
  debug: boolean;
  progress?: ZkInstallProgress;
};

export function resolveCircuitWasmPath(artifactsDir: string): string {
  return path.join(artifactsDir, "main_js", "main.wasm");
}

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
  return path.join(artifactsDir, "prove.json");
}

export async function readProveManifest(artifactsDir: string): Promise<ProveManifest | null> {
  try {
    return JSON.parse(await readFile(proveManifestPath(artifactsDir), "utf8")) as ProveManifest;
  } catch {
    return null;
  }
}

export async function hashFileContents(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath, "utf8"))
    .digest("hex");
}

export async function proveCircuit(options: ProveCircuitOptions): Promise<void> {
  const snarkjs = await ensureSnarkjs(options.progress);
  const artifactsDir = path.resolve(options.artifactsDir);
  const wasmPath = resolveCircuitWasmPath(artifactsDir);
  const zkeyPath = path.join(artifactsDir, "circuit_final.zkey");
  const zkeyVkPath = path.join(artifactsDir, "verification_key.json");
  const inputPath = path.resolve(options.inputPath);
  const proofPath = path.join(artifactsDir, "proof.json");
  const publicPath = path.join(artifactsDir, "public.json");

  await mkdir(artifactsDir, { recursive: true });

  try {
    if (options.debug) {
      const witnessPath = path.join(artifactsDir, "witness.wtns");
      await runCommand(snarkjs, ["wtns", "calculate", wasmPath, inputPath, witnessPath, "-v"]);
      await runCommand(snarkjs, ["groth16", "prove", zkeyPath, witnessPath, proofPath, publicPath]);
    } else {
      await runCommand(snarkjs, [
        "groth16",
        "fullprove",
        inputPath,
        wasmPath,
        zkeyPath,
        proofPath,
        publicPath,
      ]);
    }
  } catch (error) {
    // Only input-shaped failures are re-mapped; anything else propagates
    // unchanged so the underlying command error stays the reported cause.
    throw toZkInputError(error, inputPath);
  }

  await access(proofPath);
  await access(publicPath);

  const publicSignals = await readPublicSignalsCount(publicPath);
  await writeFile(
    proveManifestPath(artifactsDir),
    `${JSON.stringify(
      {
        circuitName: options.circuitName,
        inputHash: await hashFileContents(inputPath),
        vkHash: await hashFileContents(zkeyVkPath),
        publicSignals,
        generatedAt: new Date().toISOString(),
      } satisfies ProveManifest,
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function readPublicSignalsCount(publicPath: string): Promise<number> {
  try {
    const raw = JSON.parse(await readFile(publicPath, "utf8")) as unknown;
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}
