import { isMainnetNetwork, type NetworkConfig } from "@caatinga/core";
import { ZkError } from "../errors/ZkError.js";
import { assertCeremonyIntegrity } from "./ceremony-integrity.js";
import { DEV_CEREMONY_TYPE, MPC_CEREMONY_TYPE, readCeremonyManifest } from "./ceremony-manifest.js";

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
