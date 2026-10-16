import { readFileSync } from "node:fs";
import path from "node:path";
import type { CaatingaConfig, NetworkConfig } from "@caatinga/core";
import { assertProtocolForZk, CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import {
  assertDevCeremonyAllowed,
  isProductionNetwork,
  readCeremonyManifest,
  zkArtifactsDir,
  MPC_CEREMONY_TYPE,
  ZkError,
} from "@caatinga/zk";

export function listZkCircuitsForVerifier(
  config: CaatingaConfig,
  verifierContract: string
): string[] {
  const circuits = config.zk?.circuits ?? {};
  return Object.entries(circuits)
    .filter(([, circuit]) => circuit.verifierContract === verifierContract)
    .map(([name]) => name);
}

export function resolveContractNamesForDeploy(
  config: CaatingaConfig,
  contractName?: string
): string[] {
  if (contractName) {
    return [contractName];
  }
  return Object.keys(config.contracts);
}

export async function assertZkBuildNetworkAllowed(options: {
  networkName: string;
  networkConfig?: NetworkConfig;
  allowDevCeremony: boolean;
  /**
   * Artifacts directory for the circuit. When it already holds a valid MPC
   * ceremony manifest, the build does not run a dev ceremony, so the mainnet
   * block must not apply.
   */
  artifactsDir?: string;
}): Promise<void> {
  if (
    !isProductionNetwork(options.networkName, options.networkConfig) ||
    options.allowDevCeremony
  ) {
    return;
  }

  if (options.artifactsDir) {
    const manifest = await readCeremonyManifest(options.artifactsDir);
    if (manifest?.type === MPC_CEREMONY_TYPE) {
      return;
    }
  }

  throw new ZkError(
    `\`ctg zk build\` is blocked for mainnet network "${options.networkName}": it always runs a single-party development ceremony.`,
    "ZK_DEV_CEREMONY_BLOCKED",
    "Target testnet (`--network testnet` or defaultNetwork), import audited MPC ceremony artifacts with `ctg zk import-ceremony`, or pass --allow-dev-ceremony only for conscious testing."
  );
}

export async function assertZkVerifierDeployAllowed(options: {
  config: CaatingaConfig;
  contractNames: string[];
  networkName: string;
  networkConfig?: NetworkConfig;
  allowDevCeremony: boolean;
}): Promise<void> {
  for (const contractName of options.contractNames) {
    const circuitNames = listZkCircuitsForVerifier(options.config, contractName);
    for (const circuitName of circuitNames) {
      await assertDevCeremonyAllowed({
        networkName: options.networkName,
        networkConfig: options.networkConfig,
        artifactsDir: zkArtifactsDir(circuitName),
        allowDevCeremony: options.allowDevCeremony,
        operation: `ctg deploy ${contractName}`,
      });
    }
  }
}

/** Marker the scaffold placeholder carries, so a stale vk.rs is detectable. */
const EMBEDDED_VK_PLACEHOLDER_MARKER = "PLACEHOLDER verification key shipped with the scaffold";

/**
 * Guards the embedded-VK invoke path.
 *
 * `ctg zk invoke --embed-vk` only works against a verifier built with
 * `ctg zk build --embed-vk` — an older verifier contract has no
 * `verify_proof_embedded` entrypoint, and calling it would fail on-chain with a
 * much less useful "method not found". So check the generated source here,
 * where a clear message is still possible.
 */
export function assertEmbedVkInvokeSupported(options: {
  embedVk: boolean;
  verifierSrcDir?: string;
}): void {
  if (!options.embedVk) {
    return;
  }

  const vkPath = path.join(
    options.verifierSrcDir ?? path.resolve("contracts", "verifier", "src"),
    "vk.rs"
  );

  let source: string | undefined;
  try {
    source = readFileSync(vkPath, "utf8");
  } catch {
    source = undefined;
  }

  if (source === undefined) {
    throw new CaatingaError(
      "`ctg zk invoke --embed-vk` requires contracts/verifier/src/vk.rs, which was not found.",
      CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
      "Run `ctg zk build <circuit> --embed-vk` to generate vk.rs, then `ctg build verifier` and `ctg deploy verifier` before invoking with --embed-vk."
    );
  }

  if (source.includes(EMBEDDED_VK_PLACEHOLDER_MARKER)) {
    throw new CaatingaError(
      "`ctg zk invoke --embed-vk` cannot be used while vk.rs is still the scaffold placeholder.",
      CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
      "Run `ctg zk build <circuit> --embed-vk` to regenerate vk.rs, then rebuild and redeploy the verifier."
    );
  }
}

/**
 * Pre-flight protocol version check for contracts that back a ZK verifier.
 *
 * Only circuits whose `verifierContract` is in `contractNames` are considered,
 * so a non-ZK deploy on the same project never pays the RPC round-trip. Returns
 * an advisory note when the protocol could not be determined (never a hard
 * failure — an unreachable RPC would only trade one error for a worse one).
 */
export async function assertProtocolForZkVerifiers(options: {
  config: CaatingaConfig;
  contractNames: string[];
  networkName: string;
  networkConfig: NetworkConfig;
  operation: string;
  /** Overrides the protocol version, bypassing the RPC call (used by tests). */
  protocolVersion?: number;
}): Promise<string | undefined> {
  const verifierCircuits = options.contractNames.flatMap((contractName) =>
    listZkCircuitsForVerifier(options.config, contractName)
  );

  if (verifierCircuits.length === 0) {
    return undefined;
  }

  return assertProtocolForZk({
    networkName: options.networkName,
    networkConfig: options.networkConfig,
    operation: options.operation,
    protocolVersion: options.protocolVersion,
  });
}
