import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMainnetNetwork, type NetworkConfig } from "@caatinga/core";
import { ZkError } from "../errors/ZkError.js";
import {
  assertCeremonyIntegrity,
  type CeremonyArtifactDigests,
  type CeremonyProvenance,
} from "./ceremony-integrity.js";

export const DEV_CEREMONY_TYPE = "dev-single-party" as const;
export const MPC_CEREMONY_TYPE = "mpc-multi-party" as const;
export const CEREMONY_MANIFEST_FILE = "ceremony.json";
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

/**
 * Whether dev-ceremony artifacts must be blocked on this network. Pass the
 * network config whenever it is available so a mainnet network with a custom
 * name (e.g. `pubnet`) is detected by its passphrase, not just by name.
 */
export function isProductionNetwork(networkName: string, networkConfig?: NetworkConfig): boolean {
  if (networkConfig) {
    return isMainnetNetwork(networkName, networkConfig);
  }
  return networkName === "mainnet";
}

export function ceremonyManifestPath(artifactsDir: string): string {
  return path.join(artifactsDir, CEREMONY_MANIFEST_FILE);
}

export async function writeDevCeremonyManifest(artifactsDir: string): Promise<void> {
  const manifest: DevCeremonyManifest = {
    type: DEV_CEREMONY_TYPE,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(
    ceremonyManifestPath(artifactsDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
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
  await writeFile(ceremonyManifestPath(artifactsDir), `${JSON.stringify(full, null, 2)}\n`, "utf8");
}

/**
 * Reads whichever ceremony manifest an artifacts directory carries. Returns
 * `null` when there is none, or when it does not parse / uses an unrecognised
 * type — an unknown manifest is treated as "no ceremony recorded" rather than
 * blocking the operation, so a hand-edited manifest cannot wedge a deploy.
 */
export async function readCeremonyManifest(artifactsDir: string): Promise<CeremonyManifest | null> {
  try {
    const raw = await readFile(ceremonyManifestPath(artifactsDir), "utf8");
    const parsed = JSON.parse(raw) as Partial<CeremonyManifest>;
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

export type AssertDevCeremonyAllowedOptions = {
  networkName: string;
  /** Resolved network config; enables passphrase-based mainnet detection. */
  networkConfig?: NetworkConfig;
  artifactsDir: string;
  allowDevCeremony: boolean;
  operation: string;
};

export async function assertDevCeremonyAllowed(
  options: AssertDevCeremonyAllowedOptions
): Promise<void> {
  if (!isProductionNetwork(options.networkName, options.networkConfig)) {
    return;
  }

  const manifest = await readCeremonyManifest(options.artifactsDir);
  // An imported MPC ceremony is allowed on mainnet only while its artifacts still
  // match the hashes recorded at import — a swapped zkey or VK would otherwise
  // ride on the ceremony's reputation.
  if (manifest?.type === MPC_CEREMONY_TYPE) {
    await assertCeremonyIntegrity({
      artifactsDir: options.artifactsDir,
      artifacts: manifest.artifacts,
      operation: options.operation,
    });
    return;
  }

  // --allow-dev-ceremony lifts the dev-ceremony block only; it never waives the
  // tamper check above.
  if (manifest?.type !== DEV_CEREMONY_TYPE || options.allowDevCeremony) {
    return;
  }

  throw new ZkError(
    `${options.operation} is blocked on mainnet: ZK artifacts were produced by a single-party development ceremony.`,
    "ZK_DEV_CEREMONY_BLOCKED",
    "Run on testnet, import audited MPC ceremony artifacts with `ctg zk import-ceremony`, or pass --allow-dev-ceremony only for conscious testing."
  );
}

/**
 * Throws `ZK_CEREMONY_INCOMPATIBLE` when the artifacts directory holds MPC
 * ceremony artifacts for a different circuit than the one being built.
 *
 * Worst case without this check: the build "succeeds", proving works, and the
 * verifier rejects the proof on-chain — a failure that looks like a broken
 * verifier rather than a stale ceremony.
 */
export async function assertCeremonyMatchesCircuit(
  artifactsDir: string,
  circuitHash: string
): Promise<void> {
  const manifest = await readCeremonyManifest(artifactsDir);
  if (manifest?.type !== MPC_CEREMONY_TYPE) {
    return;
  }

  if (manifest.circuitHash !== circuitHash) {
    throw new ZkError(
      `The MPC ceremony artifacts in ${artifactsDir} were produced from a different circuit than the current source.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "Re-run the ceremony for this circuit and import it with `ctg zk import-ceremony`, or run `ctg zk build` without existing MPC artifacts to create a fresh dev ceremony."
    );
  }
}

export function zkArtifactsDir(circuitName: string): string {
  return `.artifacts/zk/${circuitName}`;
}
