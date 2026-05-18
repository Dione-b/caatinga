import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { updateArtifact } from "../artifacts/update-artifact.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { parseContractId } from "../stellar-cli/parse-contract-id.js";
import { tryRecoverContractIdFromDeployFailure } from "../stellar-cli/recover-deploy-contract-id.js";
import { buildDependencyGraph } from "./dependency-graph.js";
import { resolveDeployArgs, type DeployArgValue } from "./resolve-deploy-args.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { resolveContract } from "./resolve-contract.js";
import {
  formatStaleWasmWarning,
  hashWasm,
  isWasmOlderThanSources,
  resolveWasmArtifactPath
} from "./wasm.js";

export type DeployContractOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  source?: string;
  cwd?: string;
  allowUntestedStellarCli?: boolean;
  force?: boolean;
  checkStaleWasm?: boolean;
  resolvedDeployArgs?: Record<string, DeployArgValue>;
  dependencies?: string[];
};

function toSnakeCaseFlag(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/^_/, "")
    .toLowerCase();
}

function formatConstructorCliArgs(resolved: Record<string, DeployArgValue>): string[] {
  const entries = Object.entries(resolved);
  if (entries.length === 0) {
    return [];
  }

  const tail: string[] = ["--"];
  for (const [key, value] of entries) {
    tail.push(`--${toSnakeCaseFlag(key)}`, String(value));
  }
  return tail;
}

export async function deployContract(options: DeployContractOptions) {
  const cwd = options.cwd ?? process.cwd();
  const contract = resolveContract(options.config, options.contractName, cwd);
  const network = resolveNetwork(options.config, options.networkName);
  const source = assertSafeSourceAccount(options.source);

  await checkBinary("stellar", "Install Stellar CLI before running caatinga deploy.", {
    allowUntestedStellarCli: options.allowUntestedStellarCli
  });
  const wasmPath = await resolveWasmArtifactPath(contract.wasmPath);
  const contractWithWasm = {
    ...contract,
    wasmPath
  };

  let staleWasmWarning: string | undefined;
  if (options.checkStaleWasm !== false) {
    const stale = await isWasmOlderThanSources({
      wasmPath,
      contractPath: contract.sourcePath
    });
    if (stale) {
      staleWasmWarning = formatStaleWasmWarning(contract.name);
    }
  }

  const artifactsBefore = await readArtifacts(cwd);
  const existing = artifactsBefore.networks[network.name]?.contracts[contract.name];
  if (existing?.contractId && !options.force) {
    return {
      contract: contractWithWasm,
      network,
      contractId: existing.contractId,
      artifactsPath: path.resolve(cwd, "caatinga.artifacts.json"),
      output: "",
      skipped: true as const,
      staleWasmWarning
    };
  }

  const rawDeployArgs = contract.config.deployArgs;
  const hasConfiguredArgs = Object.keys(rawDeployArgs).length > 0;
  let resolvedDeployArgs: Record<string, DeployArgValue>;

  if (options.resolvedDeployArgs !== undefined) {
    resolvedDeployArgs = options.resolvedDeployArgs;
  } else if (hasConfiguredArgs) {
    resolvedDeployArgs = resolveDeployArgs({
      deployArgs: rawDeployArgs,
      artifacts: artifactsBefore,
      network: network.name
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

  const constructorArgs = formatConstructorCliArgs(resolvedDeployArgs);

  const stellarArgs = [
    "contract",
    "deploy",
    "--wasm",
    wasmPath,
    "--source-account",
    source,
    ...buildStellarNetworkArgs(network),
    ...constructorArgs
  ];

  let output = "";
  let contractId: string;

  try {
    const result = await runCommand("stellar", stellarArgs, {
      cwd,
      allowUntestedStellarCli: options.allowUntestedStellarCli,
      failureCode: CaatingaErrorCode.DEPLOY_FAILED
    });
    output = result.all || `${result.stdout}\n${result.stderr}`;
    contractId = parseContractId(output);
  } catch (error) {
    if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.DEPLOY_FAILED) {
      throw error;
    }

    const recoveredContractId = await tryRecoverContractIdFromDeployFailure({
      output: `${error.message}\n${error.hint ?? ""}`,
      source,
      network: network.config,
      cwd,
      allowUntestedStellarCli: options.allowUntestedStellarCli
    });

    if (!recoveredContractId) {
      throw error;
    }

    contractId = recoveredContractId;
    output = [
      error.hint ?? "",
      "Caatinga recovered the contract ID from the on-chain deploy transaction.",
      `Contract ID: ${contractId}`
    ].filter(Boolean).join("\n");
  }
  const wasmHash = await hashWasm(wasmPath);
  const dependencyGraph = buildDependencyGraph(options.config.contracts);
  const dependencies = options.dependencies ?? contract.config.dependsOn;

  const nextArtifacts = updateArtifact(
    artifactsBefore,
    network.name,
    contract.name,
    {
      contractId,
      wasmHash,
      deployedAt: new Date().toISOString(),
      sourcePath: contract.config.path,
      wasmPath: contract.config.wasm,
      dependencies,
      resolvedDeployArgs
    },
    { dependencyGraph }
  );
  const artifactsPath = await writeArtifacts(nextArtifacts, cwd);

  return {
    contract: contractWithWasm,
    network,
    contractId,
    artifactsPath,
    output,
    skipped: false as const,
    staleWasmWarning
  };
}
