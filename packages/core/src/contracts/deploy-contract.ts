import path from "node:path";
import { withArtifactsLock } from "../artifacts/artifacts-lock.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { updateArtifact } from "../artifacts/update-artifact.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";
import { collectDeploymentMetadata } from "../artifacts/metadata.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { isMainnetNetwork } from "../networks/mainnet-guardrails.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { parseContractId } from "../stellar-cli/parse-contract-id.js";
import { tryRecoverContractIdFromDeployFailure } from "../stellar-cli/recover-deploy-contract-id.js";
import { isTransientDeployFailure } from "./is-transient-deploy-failure.js";
import { buildDependencyGraph } from "./dependency-graph.js";
import { formatConstructorCliArgs } from "./format-cli-args.js";
import { resolveDeployArgs, type DeployArgValue } from "./resolve-deploy-args.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { resolveContract } from "./resolve-contract.js";
import {
  formatStaleWasmWarning,
  hashWasm,
  isWasmOlderThanSources,
  resolveWasmArtifactPath,
} from "./wasm.js";

export type DeployContractOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  source?: string;
  cwd?: string;
  force?: boolean;
  upgrade?: boolean;
  ifChanged?: boolean;
  checkStaleWasm?: boolean;
  resolvedDeployArgs?: Record<string, DeployArgValue>;
  dependencies?: string[];
  onTransientDeployRetry?: (info: {
    attempt: number;
    maxAttempts: number;
    delayMs: number;
  }) => void;
  /** Override retry backoff delays (primarily for tests). */
  deployRetryDelaysMs?: readonly number[];
};

const DEFAULT_DEPLOY_RETRY_DELAYS_MS = [2000, 5000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function deployContract(options: DeployContractOptions) {
  const cwd = options.cwd ?? process.cwd();
  const contract = resolveContract(options.config, options.contractName, cwd);
  const network = resolveNetwork(options.config, options.networkName);
  const source = assertSafeSourceAccount(options.source);

  await checkBinary("stellar", "Install Stellar CLI before running ctg deploy.");
  const wasmPath = await resolveWasmArtifactPath(contract.wasmPath, {
    sourcePath: contract.sourcePath,
  });
  const contractWithWasm = {
    ...contract,
    wasmPath,
  };

  let staleWasmWarning: string | undefined;
  if (options.checkStaleWasm !== false) {
    const stale = await isWasmOlderThanSources({
      wasmPath,
      contractPath: contract.sourcePath,
    });
    if (stale) {
      staleWasmWarning = formatStaleWasmWarning(contract.name);
    }
  }

  const artifactsBefore = await readArtifacts(cwd);
  const existing = artifactsBefore.networks[network.name]?.contracts[contract.name];
  const localWasmHash = await hashWasm(wasmPath);

  if (existing?.contractId && !options.force) {
    if (options.ifChanged) {
      if (existing.wasmHash === localWasmHash) {
        return {
          contract: contractWithWasm,
          network,
          contractId: existing.contractId,
          artifactsPath: path.resolve(cwd, "caatinga.artifacts.json"),
          output: "",
          skipped: true as const,
          staleWasmWarning,
          skipReason: "unchanged-wasm" as const,
        };
      }
    } else {
      return {
        contract: contractWithWasm,
        network,
        contractId: existing.contractId,
        artifactsPath: path.resolve(cwd, "caatinga.artifacts.json"),
        output: "",
        skipped: true as const,
        staleWasmWarning,
      };
    }
  }

  const rawDeployArgs = contract.config.deployArgs;
  const hasConfiguredArgs = Object.keys(rawDeployArgs).length > 0;
  let resolvedDeployArgs: Record<string, DeployArgValue>;

  if (options.resolvedDeployArgs !== undefined) {
    resolvedDeployArgs = options.resolvedDeployArgs;
  } else if (hasConfiguredArgs) {
    resolvedDeployArgs = await resolveDeployArgs({
      deployArgs: rawDeployArgs,
      artifacts: artifactsBefore,
      network: network.name,
      source,
      cwd,
    });
  } else {
    resolvedDeployArgs = {};
  }

  for (const value of Object.values(resolvedDeployArgs)) {
    if (typeof value === "string" && value.includes("${")) {
      throw new CaatingaError(
        `Deploy args for "${contract.name}" still contain unresolved placeholders.`,
        CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_UNRESOLVED,
        "Deploy dependencies first or fix deployArgs templates."
      );
    }
  }

  const constructorArgs = ["--", ...formatConstructorCliArgs(resolvedDeployArgs)];

  const stellarArgs = [
    "contract",
    "deploy",
    "--wasm",
    wasmPath,
    "--source-account",
    source,
    ...buildStellarNetworkArgs(network),
    ...constructorArgs,
  ];

  let deployOutcome: { output: string; contractId: string } | undefined;
  const defaultRetryDelays = isMainnetNetwork(network.name, network.config)
    ? []
    : DEFAULT_DEPLOY_RETRY_DELAYS_MS;
  const retryDelaysMs = options.deployRetryDelaysMs ?? defaultRetryDelays;
  const maxDeployAttempts = retryDelaysMs.length + 1;

  for (let attempt = 0; attempt < maxDeployAttempts; attempt++) {
    try {
      const result = await runCommand("stellar", stellarArgs, {
        cwd,
        failureCode: CaatingaErrorCode.DEPLOY_FAILED,
      });
      const output = result.all || `${result.stdout}\n${result.stderr}`;
      deployOutcome = {
        output,
        contractId: parseContractId(output),
      };
      break;
    } catch (error) {
      if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.DEPLOY_FAILED) {
        throw error;
      }

      const recoveredContractId = await tryRecoverContractIdFromDeployFailure({
        output: `${error.message}\n${error.hint ?? ""}`,
        source,
        network: network.config,
        cwd,
      });

      if (recoveredContractId) {
        deployOutcome = {
          output: [
            error.hint ?? "",
            "Caatinga recovered the contract ID from the on-chain deploy transaction.",
            `Contract ID: ${recoveredContractId}`,
          ]
            .filter(Boolean)
            .join("\n"),
          contractId: recoveredContractId,
        };
        break;
      }

      const isLastAttempt = attempt === maxDeployAttempts - 1;
      if (!isTransientDeployFailure(error) || isLastAttempt) {
        throw error;
      }

      const delayMs = retryDelaysMs[attempt] ?? retryDelaysMs[retryDelaysMs.length - 1] ?? 0;
      options.onTransientDeployRetry?.({
        attempt: attempt + 1,
        maxAttempts: maxDeployAttempts,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  if (!deployOutcome) {
    throw new CaatingaError(
      "Deploy failed without a contract ID.",
      CaatingaErrorCode.DEPLOY_FAILED,
      "Re-run the deploy command with the underlying Stellar CLI for full diagnostics."
    );
  }

  const { output, contractId } = deployOutcome;
  const wasmHash = localWasmHash;
  const dependencyGraph = buildDependencyGraph(options.config.contracts);
  const dependencies = options.dependencies ?? contract.config.dependsOn;
  const supersedeReason =
    existing?.contractId && options.force
      ? options.upgrade
        ? ("upgrade" as const)
        : ("force-redeploy" as const)
      : undefined;

  const metadata = await collectDeploymentMetadata({
    networkName: network.name,
    wasmHash,
    cwd,
  });

  const artifactsPath = await withArtifactsLock(cwd, async () => {
    const latestArtifacts = await readArtifacts(cwd);
    const nextArtifacts = updateArtifact(
      latestArtifacts,
      network.name,
      contract.name,
      {
        contractId,
        wasmHash,
        deployedAt: new Date().toISOString(),
        sourcePath: contract.config.path,
        wasmPath: contract.config.wasm,
        dependencies,
        resolvedDeployArgs,
        metadata,
      },
      {
        dependencyGraph,
        supersedeReason,
        upgradeType: supersedeReason ? "new-contract" : undefined,
        upgradeStrategy: supersedeReason ? "redeploy" : undefined,
      }
    );
    return writeArtifacts(nextArtifacts, cwd);
  });

  return {
    contract: contractWithWasm,
    network,
    contractId,
    artifactsPath,
    output,
    skipped: false as const,
    staleWasmWarning,
  };
}
