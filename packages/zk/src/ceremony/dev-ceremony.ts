import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMainnetNetwork, type NetworkConfig } from "@caatinga/core";
import { ZkError } from "../errors/ZkError.js";

export const DEV_CEREMONY_TYPE = "dev-single-party" as const;
export const CEREMONY_MANIFEST_FILE = "ceremony.json";

export type DevCeremonyManifest = {
  type: typeof DEV_CEREMONY_TYPE;
  generatedAt: string;
};

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

export async function readDevCeremonyManifest(
  artifactsDir: string
): Promise<DevCeremonyManifest | null> {
  try {
    const raw = await readFile(ceremonyManifestPath(artifactsDir), "utf8");
    const parsed = JSON.parse(raw) as DevCeremonyManifest;
    if (parsed.type !== DEV_CEREMONY_TYPE) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

  if (options.allowDevCeremony) {
    return;
  }

  const manifest = await readDevCeremonyManifest(options.artifactsDir);
  if (!manifest) {
    return;
  }

  throw new ZkError(
    `${options.operation} is blocked on mainnet: ZK artifacts were produced by a single-party development ceremony.`,
    "ZK_DEV_CEREMONY_BLOCKED",
    "Run on testnet, supply audited MPC ceremony artifacts, or pass --allow-dev-ceremony only for conscious testing."
  );
}

export function zkArtifactsDir(circuitName: string): string {
  return `.artifacts/zk/${circuitName}`;
}
