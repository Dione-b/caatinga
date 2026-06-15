import { runCommand } from "@caatinga/core";
import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { ensureSnarkjs } from "../install/lazy-install-zk-tools.js";

export type ProveCircuitOptions = {
  circuitName: string;
  circuitPath: string;
  artifactsDir: string;
  inputPath: string;
  debug: boolean;
};

export function resolveCircuitWasmPath(artifactsDir: string): string {
  return path.join(artifactsDir, "main_js", "main.wasm");
}

export async function proveCircuit(options: ProveCircuitOptions): Promise<void> {
  const snarkjs = await ensureSnarkjs();
  const artifactsDir = path.resolve(options.artifactsDir);
  const wasmPath = resolveCircuitWasmPath(artifactsDir);
  const zkeyPath = path.join(artifactsDir, "circuit_final.zkey");
  const inputPath = path.resolve(options.inputPath);
  const proofPath = path.join(artifactsDir, "proof.json");
  const publicPath = path.join(artifactsDir, "public.json");

  await mkdir(artifactsDir, { recursive: true });

  if (options.debug) {
    const witnessPath = path.join(artifactsDir, "witness.wtns");
    await runCommand(snarkjs, ["wtns", "calculate", wasmPath, inputPath, witnessPath, "-v"]);
    await runCommand(snarkjs, ["groth16", "prove", zkeyPath, witnessPath, proofPath, publicPath]);
    return;
  }

  await runCommand(snarkjs, [
    "groth16",
    "fullprove",
    inputPath,
    wasmPath,
    zkeyPath,
    proofPath,
    publicPath,
  ]);

  await access(proofPath);
  await access(publicPath);
}
