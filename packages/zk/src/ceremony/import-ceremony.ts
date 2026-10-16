import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { runCommand } from "@caatinga/core";
import { ZkError } from "../errors/ZkError.js";
import { ensureSnarkjs } from "../install/lazy-install-zk-tools.js";
import type { ZkInstallProgress } from "../install/install-progress.js";
import {
  MPC_CEREMONY_MANIFEST_VERSION,
  MPC_CEREMONY_TYPE,
  readCeremonyManifest,
  writeMpcCeremonyManifest,
} from "./dev-ceremony.js";
import {
  digestCeremonyArtifacts,
  type CeremonyArtifactDigests,
  type CeremonyProvenance,
} from "./ceremony-integrity.js";

export const MPC_ZKEY_FILENAME = "circuit_final.zkey";
export const MPC_VERIFICATION_KEY_FILENAME = "verification_key.json";

const PTAU_SUFFIX = ".ptau";
// snarkjs `r1cs info` reports these counters separately; a circuit's public
// signals are its public inputs plus its outputs.
const PUBLIC_INPUTS_PATTERN = /# of Public Inputs:\s+(\d+)/;
const OUTPUTS_PATTERN = /# of Outputs:\s+(\d+)/;

export type ImportCeremonyOptions = {
  circuitName: string;
  /** Directory holding the circuit sources (`main.circom`). */
  circuitPath: string;
  /** Artifacts directory to write into (`.artifacts/zk/<circuit>`). */
  artifactsDir: string;
  /** Directory holding the MPC ceremony output to import. */
  ceremonyDir: string;
  /** Provenance recorded in `ceremony.json`; `retrievedAt` defaults to now. */
  provenance?: Partial<Omit<CeremonyProvenance, "curve">>;
  progress?: ZkInstallProgress;
};

export type ImportCeremonyResult = {
  circuitHash: string;
  publicSignals: number;
  zkeyPath: string;
  verificationKeyPath: string;
  /** Powers-of-tau file copied alongside, when the ceremony shipped one. */
  ptauPath?: string;
  artifacts: CeremonyArtifactDigests;
};

/**
 * sha256 over the circuit sources, sorted by path so the digest is stable
 * regardless of directory iteration order. Hashing the source rather than the
 * compiled `.r1cs` keeps the manifest meaningful to users: it compares equal
 * exactly when the circuit being built is the one the ceremony ran against.
 */
export async function hashCircuitSources(circuitPath: string): Promise<string> {
  const circuitDir = path.resolve(circuitPath);
  const entries = (await readdir(circuitDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".circom"))
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    throw new ZkError(
      `No .circom sources found in ${circuitDir}.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "Add the circuit sources, or point the circuit `path` in caatinga.config.ts at the directory containing them."
    );
  }

  const hash = createHash("sha256");
  for (const name of entries) {
    hash.update(name);
    hash.update(await readFile(path.join(circuitDir, name), "utf8"));
  }

  return hash.digest("hex");
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Imports audited MPC ceremony artifacts in place of the dev ceremony.
 *
 * The ceremony's zkey and verification key must describe the same circuit as the
 * local sources. That is checked by comparing the public-signal count implied by
 * the verification key's `ic` array against the count the compiled circuit
 * reports — the strongest cross-check available without re-running the entire
 * phase-2 verification, and the one that catches the mistake that otherwise
 * surfaces as an unexplained on-chain verification failure.
 */
export async function importCeremony(
  options: ImportCeremonyOptions
): Promise<ImportCeremonyResult> {
  const ceremonyDir = path.resolve(options.ceremonyDir);
  const artifactsDir = path.resolve(options.artifactsDir);
  const zkeySource = path.join(ceremonyDir, MPC_ZKEY_FILENAME);
  const vkSource = path.join(ceremonyDir, MPC_VERIFICATION_KEY_FILENAME);

  for (const [label, target] of [
    ["proving key", zkeySource],
    ["verification key", vkSource],
  ] as const) {
    if (!(await exists(target))) {
      throw new ZkError(
        `No ${label} found at ${target}.`,
        "ZK_CEREMONY_INCOMPATIBLE",
        `Point --ceremony at the directory that holds ${MPC_ZKEY_FILENAME} and ${MPC_VERIFICATION_KEY_FILENAME} from the ceremony output.`
      );
    }
  }

  const circuitHash = await hashCircuitSources(options.circuitPath);

  const r1csPath = path.join(artifactsDir, "main.r1cs");
  if (!(await exists(r1csPath))) {
    throw new ZkError(
      `No compiled circuit found at ${r1csPath}.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      `Run \`ctg zk build ${options.circuitName}\` first — it compiles the circuit so the ceremony artifacts can be validated against it.`
    );
  }

  const snarkjs = await ensureSnarkjs(options.progress);
  const r1csInfo = await runCommand(snarkjs, ["r1cs", "info", r1csPath]);
  const publicInputs = r1csInfo.stdout.match(PUBLIC_INPUTS_PATTERN);
  const outputs = r1csInfo.stdout.match(OUTPUTS_PATTERN);
  if (!publicInputs || !outputs) {
    throw new ZkError(
      `Could not read the public signal counts from ${r1csPath}.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "Re-run `ctg zk build` to recompile the circuit, then import the ceremony artifacts again."
    );
  }
  const publicSignals = Number.parseInt(publicInputs[1]!, 10) + Number.parseInt(outputs[1]!, 10);

  const verificationKey = JSON.parse(await readFile(vkSource, "utf8")) as {
    ic?: unknown[];
    vk_ic?: unknown[];
    IC?: unknown[];
    nPublic?: unknown;
    protocol?: unknown;
    curve?: unknown;
  };
  const ic = [verificationKey.ic, verificationKey.vk_ic, verificationKey.IC].find((candidate) =>
    Array.isArray(candidate)
  );

  if (!ic || ic.length < 2) {
    throw new ZkError(
      `The verification key at ${vkSource} has no usable IC array.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      `Confirm the file is the output of \`snarkjs zkey export verificationkey\`.`
    );
  }

  // Prefer the explicit nPublic; fall back to IC length (always nPublic + 1).
  const keyPublicSignals =
    typeof verificationKey.nPublic === "number" && Number.isInteger(verificationKey.nPublic)
      ? verificationKey.nPublic
      : ic.length - 1;

  if (keyPublicSignals !== publicSignals) {
    throw new ZkError(
      `The verification key declares ${keyPublicSignals} public signal(s), but circuit "${options.circuitName}" has ${publicSignals}.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "The ceremony artifacts were produced from a different circuit. Re-run the ceremony for this circuit, then import them again."
    );
  }

  if (verificationKey.protocol !== "groth16") {
    throw new ZkError(
      `The verification key is not a Groth16 key (protocol: ${String(verificationKey.protocol)}).`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "Only groth16 is supported on Soroban. Re-run the ceremony with the groth16 protocol."
    );
  }

  const existing = await readCeremonyManifest(artifactsDir);
  if (existing?.type === MPC_CEREMONY_TYPE && existing.circuitHash !== circuitHash) {
    options.progress?.onStatus?.(
      "Replacing MPC ceremony artifacts that belonged to an older circuit."
    );
  }

  await mkdir(artifactsDir, { recursive: true });

  const zkeyTarget = path.join(artifactsDir, MPC_ZKEY_FILENAME);
  const vkTarget = path.join(artifactsDir, MPC_VERIFICATION_KEY_FILENAME);
  await copyFile(zkeySource, zkeyTarget);
  await copyFile(vkSource, vkTarget);

  // Preserve a ceremony powers-of-tau when one shipped alongside: a later zkey
  // operation needs the ptau the ceremony was seeded from, and a downloaded dev
  // ptau would not correspond to the ceremony's contribution.
  let ptauPath: string | undefined;
  for (const entry of (await readdir(ceremonyDir)).sort()) {
    if (!entry.endsWith(PTAU_SUFFIX)) {
      continue;
    }
    const target = path.join(artifactsDir, entry);
    if (await exists(target)) {
      ptauPath = target;
      continue;
    }
    await copyFile(path.join(ceremonyDir, entry), target);
    ptauPath = target;
    break;
  }

  // Pinned so mainnet deploy/invoke can refuse artifacts swapped after import.
  const artifacts = await digestCeremonyArtifacts(artifactsDir, {
    zkey: MPC_ZKEY_FILENAME,
    verificationKey: MPC_VERIFICATION_KEY_FILENAME,
    r1cs: "main.r1cs",
    wasm: path.join("main_js", "main.wasm"),
    ...(ptauPath ? { ptau: path.basename(ptauPath) } : {}),
  });

  await writeMpcCeremonyManifest(artifactsDir, {
    version: MPC_CEREMONY_MANIFEST_VERSION,
    circuitHash,
    publicSignals,
    source: ceremonyDir,
    artifacts,
    provenance: {
      ...options.provenance,
      retrievedAt: options.provenance?.retrievedAt ?? new Date().toISOString(),
      curve: "bls12381",
    },
  });

  return {
    circuitHash,
    publicSignals,
    zkeyPath: zkeyTarget,
    verificationKeyPath: vkTarget,
    ptauPath,
    artifacts,
  };
}
