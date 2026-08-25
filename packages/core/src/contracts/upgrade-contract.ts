import { withArtifactsLock } from "../artifacts/artifacts-lock.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { updateArtifact } from "../artifacts/update-artifact.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";
import { collectDeploymentMetadata } from "../artifacts/metadata.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { isTransientCaatingaFailure } from "../shell/is-transient-command-failure.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { buildContract } from "./build-contract.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { resolveContract } from "./resolve-contract.js";
import { uploadWasm } from "./upload-wasm.js";
import { hashWasm, resolveWasmArtifactPath } from "./wasm.js";
import { WASM_NOT_YET_INDEXED_PATTERN } from "./wasm-indexing-pattern.js";

export type UpgradeContractOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  source?: string;
  cwd?: string;
  ifChanged?: boolean;
  expectedHash?: string;
  build?: boolean;
  upgradeMethod?: string;
  wasmArg?: string;
  onTransientUpgradeRetry?: (info: {
    attempt: number;
    maxAttempts: number;
    delayMs: number;
  }) => void;
  /** Override retry backoff delays (primarily for tests). */
  upgradeRetryDelaysMs?: readonly number[];
};

export type UpgradeContractResult = {
  contractName: string;
  contractId: string;
  wasmHash: string;
  network: ReturnType<typeof resolveNetwork>;
  skipped: boolean;
  artifactPath: string;
};

const DEFAULT_UPGRADE_RETRY_DELAYS_MS = [2000, 5000] as const;
const DEFAULT_UPGRADE_METHOD = "upgrade";
const DEFAULT_WASM_ARG = "new_wasm_hash";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientUpgradeFailure(error: unknown): boolean {
  if (error instanceof CaatingaError && error.code === CaatingaErrorCode.INVOKE_FAILED) {
    if (WASM_NOT_YET_INDEXED_PATTERN.test(`${error.message}\n${error.hint ?? ""}`)) {
      return true;
    }
  }
  return isTransientCaatingaFailure(error, CaatingaErrorCode.INVOKE_FAILED);
}

export async function upgradeContractInPlace(
  options: UpgradeContractOptions
): Promise<UpgradeContractResult> {
  const cwd = options.cwd ?? process.cwd();
  const contract = resolveContract(options.config, options.contractName, cwd);
  const network = resolveNetwork(options.config, options.networkName);
  const source = assertSafeSourceAccount(options.source);
  const upgradeMethod = options.upgradeMethod ?? DEFAULT_UPGRADE_METHOD;
  const wasmArg = options.wasmArg ?? DEFAULT_WASM_ARG;

  await checkBinary("stellar", "Install Stellar CLI before running ctg upgrade.");

  const artifactsBefore = await readArtifacts(cwd);
  const existing = artifactsBefore.networks[network.name]?.contracts[contract.name];

  if (!existing?.contractId) {
    throw new CaatingaError(
      `No deployed artifact found for "${contract.name}" on "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run ctg deploy before ctg upgrade."
    );
  }

  if (options.build !== false) {
    await buildContract({
      config: options.config,
      contractName: contract.name,
      cwd,
    });
  }

  const wasmPath = await resolveWasmArtifactPath(contract.wasmPath, {
    sourcePath: contract.sourcePath,
  });
  const localWasmHash = await hashWasm(wasmPath);

  if (options.ifChanged && existing.wasmHash === localWasmHash) {
    return {
      contractName: contract.name,
      contractId: existing.contractId,
      wasmHash: existing.wasmHash,
      network,
      skipped: true,
      artifactPath: cwd,
    };
  }

  const upload = await uploadWasm({
    wasmPath,
    network,
    source,
    cwd,
    expectedHash: options.expectedHash,
  });

  const retryDelaysMs = options.upgradeRetryDelaysMs ?? DEFAULT_UPGRADE_RETRY_DELAYS_MS;
  const maxAttempts = retryDelaysMs.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await runCommand(
        "stellar",
        [
          "contract",
          "invoke",
          "--id",
          existing.contractId,
          "--source-account",
          source,
          ...buildStellarNetworkArgs(network),
          "--",
          upgradeMethod,
          `--${wasmArg}`,
          upload.wasmHash,
        ],
        {
          cwd,
          failureCode: CaatingaErrorCode.INVOKE_FAILED,
        }
      );
      break;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!isTransientUpgradeFailure(error) || isLastAttempt) {
        if (error instanceof CaatingaError && error.code === CaatingaErrorCode.INVOKE_FAILED) {
          throw new CaatingaError(
            error.message,
            error.code,
            `Ensure "${contract.name}" exposes ${upgradeMethod}(${wasmArg}) with admin auth, or use ctg deploy --upgrade for redeploy.`,
            error
          );
        }
        throw error;
      }

      const delayMs = retryDelaysMs[attempt] ?? retryDelaysMs[retryDelaysMs.length - 1] ?? 0;
      options.onTransientUpgradeRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  const metadata = await collectDeploymentMetadata({
    networkName: network.name,
    wasmHash: upload.wasmHash,
    cwd,
  });

  const deployedAt = new Date().toISOString();
  const artifactPath = await withArtifactsLock(cwd, async () => {
    const latestArtifacts = await readArtifacts(cwd);
    const nextArtifacts = updateArtifact(
      latestArtifacts,
      network.name,
      contract.name,
      {
        contractId: existing.contractId,
        wasmHash: upload.wasmHash,
        deployedAt,
        sourcePath: contract.sourcePath,
        wasmPath: contract.config.wasm,
        dependencies: existing.dependencies ?? contract.config.dependsOn ?? [],
        resolvedDeployArgs: existing.resolvedDeployArgs ?? {},
        upgradeStrategy: "in-place",
        metadata,
      },
      {
        supersedeReason: "upgrade",
        upgradeType: "in-place",
        upgradeStrategy: "in-place",
      }
    );

    return writeArtifacts(nextArtifacts, cwd);
  });

  return {
    contractName: contract.name,
    contractId: existing.contractId,
    wasmHash: upload.wasmHash,
    network,
    skipped: false,
    artifactPath,
  };
}
