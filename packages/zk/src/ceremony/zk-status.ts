import type { CaatingaConfig } from "@caatinga/core";
import { access } from "node:fs/promises";
import { hashFileContents, readProveManifest } from "../prove/prove-circuit.js";
import { hashCircuitSources } from "../ceremony/import-ceremony.js";
import { MPC_CEREMONY_TYPE, readCeremonyManifest } from "../ceremony/dev-ceremony.js";
import path from "node:path";

export type ZkDriftStatus =
  | "not-built"
  | "up-to-date"
  | "circuit-changed"
  | "input-changed"
  | "vk-changed"
  | "artifacts-missing";

export type ZkCircuitStatus = {
  name: string;
  status: ZkDriftStatus;
  /** Recorded ceremony type, when a manifest exists. */
  ceremonyType?: "dev-single-party" | "mpc-multi-party";
  /** Whether the circuit's current hash differs from the recorded one. */
  circuitChanged?: boolean;
  /** Whether `input.json` differs from the one the last proof used. */
  inputChanged?: boolean;
  /** Whether the verification key changed after the last proof was generated. */
  vkChanged?: boolean;
  proofExists: boolean;
  inputExists: boolean;
  inputPath: string;
  advisories: string[];
};

export type CollectZkStatusOptions = {
  config: CaatingaConfig;
  cwd?: string;
};

/**
 * Reports ZK artifact drift per configured circuit.
 *
 * Only circuits whose circuit hash or input hash is actually recorded can be
 * judged — a dev ceremony stores no circuit hash, so those circuits are
 * reported as up-to-date rather than guessed at. Anything that cannot be
 * determined is left `undefined` instead of assumed.
 */
export async function collectZkStatus(options: CollectZkStatusOptions): Promise<ZkCircuitStatus[]> {
  const cwd = options.cwd ?? process.cwd();
  const circuits = options.config.zk?.circuits ?? {};
  const statuses: ZkCircuitStatus[] = [];

  for (const [name, circuit] of Object.entries(circuits)) {
    const artifactsDir = path.join(cwd, ".artifacts", "zk", name);
    const circuitPath = path.join(cwd, circuit.path);
    const inputPath = path.join(circuitPath, "input.json");
    const advisories: string[] = [];

    const manifest = await readCeremonyManifest(artifactsDir);
    const prove = await readProveManifest(artifactsDir);
    const inputExists = await fileExists(inputPath);
    const proofExists = await fileExists(path.join(artifactsDir, "proof.json"));

    const status: ZkCircuitStatus = {
      name,
      status: "up-to-date",
      ceremonyType: manifest?.type,
      proofExists,
      inputExists,
      inputPath,
      advisories,
    };

    if (!manifest) {
      status.status = "not-built";
      advisories.push(
        `Run \`ctg zk build ${name}\` to compile the circuit and run the trusted setup.`
      );
      statuses.push(status);
      continue;
    }

    let currentCircuitHash: string | undefined;
    try {
      currentCircuitHash = await hashCircuitSources(circuitPath);
    } catch {
      advisories.push(
        `No .circom sources found at ${circuit.path}; circuit drift cannot be checked.`
      );
    }

    if (manifest.type === MPC_CEREMONY_TYPE) {
      if (currentCircuitHash && manifest.circuitHash !== currentCircuitHash) {
        status.circuitChanged = true;
        advisories.push(
          "The circuit sources changed since the ceremony was imported. `ctg zk build` will refuse to reuse the artifacts."
        );
      }
    }

    if (inputExists && prove) {
      const currentInputHash = await hashFileContents(path.join(cwd, circuit.path, "input.json"));
      if (currentInputHash !== prove.inputHash) {
        status.inputChanged = true;
        advisories.push(
          `\`${circuit.path}/input.json\` changed since \`ctg zk prove ${name}\` was last run.`
        );
      }
    } else if (!inputExists) {
      advisories.push(`No input.json found at ${circuit.path}/input.json.`);
    }

    // A ceremony import replaces the verification key, which invalidates any
    // proof still sitting in the artifacts directory.
    const vkPath = path.join(artifactsDir, "verification_key.json");
    if (prove && (await fileExists(vkPath))) {
      const currentVkHash = await hashFileContents(vkPath);
      if (prove.vkHash && prove.vkHash !== currentVkHash) {
        status.vkChanged = true;
        advisories.push(
          `The verification key changed since \`ctg zk prove ${name}\` was last run (a ceremony was imported?). Run \`ctg zk prove ${name}\` again before invoking the verifier.`
        );
      }
    }

    if (status.circuitChanged) {
      status.status = "circuit-changed";
    } else if (status.vkChanged) {
      status.status = "vk-changed";
    } else if (status.inputChanged) {
      status.status = "input-changed";
    } else if (!proofExists) {
      advisories.push(`No proof found; run \`ctg zk prove ${name}\`.`);
    }

    statuses.push(status);
  }

  return statuses;
}

function fileExists(target: string): Promise<boolean> {
  return access(target).then(
    () => true,
    () => false
  );
}
