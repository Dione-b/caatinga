import path from "node:path";

/**
 * File layout of the ZK flow. Every step (build, prove, invoke, ceremony
 * import/verify, status) reads and writes the same files, so their names live
 * here instead of being repeated as string literals in each step.
 */

/** Entry point `ctg zk build` compiles inside a circuit directory. */
export const CIRCUIT_ENTRY_FILE = "main.circom";
/** Witness inputs `ctg zk prove` reads from the circuit directory. */
export const CIRCUIT_INPUT_FILE = "input.json";

export const R1CS_FILE = "main.r1cs";
export const CIRCUIT_WASM_FILE = path.join("main_js", "main.wasm");
export const INITIAL_ZKEY_FILE = "circuit_0000.zkey";
export const ZKEY_FILE = "circuit_final.zkey";
export const VERIFICATION_KEY_FILE = "verification_key.json";
export const PROOF_FILE = "proof.json";
export const PUBLIC_SIGNALS_FILE = "public.json";
export const WITNESS_FILE = "witness.wtns";
export const PROVE_MANIFEST_FILE = "prove.json";
export const CEREMONY_MANIFEST_FILE = "ceremony.json";

/** Artifacts directory of a circuit, relative to the project root. */
export function zkArtifactsDir(circuitName: string): string {
  return `.artifacts/zk/${circuitName}`;
}

export type ZkArtifactPaths = {
  dir: string;
  r1cs: string;
  wasm: string;
  initialZkey: string;
  zkey: string;
  verificationKey: string;
  proof: string;
  publicSignals: string;
  witness: string;
  proveManifest: string;
  ceremonyManifest: string;
};

/** Paths of every artifact inside a circuit's artifacts directory. */
export function zkArtifactPaths(artifactsDir: string): ZkArtifactPaths {
  const file = (name: string) => path.join(artifactsDir, name);
  return {
    dir: artifactsDir,
    r1cs: file(R1CS_FILE),
    wasm: file(CIRCUIT_WASM_FILE),
    initialZkey: file(INITIAL_ZKEY_FILE),
    zkey: file(ZKEY_FILE),
    verificationKey: file(VERIFICATION_KEY_FILE),
    proof: file(PROOF_FILE),
    publicSignals: file(PUBLIC_SIGNALS_FILE),
    witness: file(WITNESS_FILE),
    proveManifest: file(PROVE_MANIFEST_FILE),
    ceremonyManifest: file(CEREMONY_MANIFEST_FILE),
  };
}

/** Source directory of the scaffolded verifier contract. */
export function verifierSourceDir(cwd: string = process.cwd()): string {
  return path.resolve(cwd, "contracts", "verifier", "src");
}

/** `vk.rs` that `ctg zk build --embed-vk` generates into the verifier contract. */
export function embeddedVkSourcePath(cwd: string = process.cwd()): string {
  return path.join(verifierSourceDir(cwd), "vk.rs");
}
