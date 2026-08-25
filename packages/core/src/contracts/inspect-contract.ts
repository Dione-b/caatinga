import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { resolveContract } from "./resolve-contract.js";
import { hashWasm, resolveWasmArtifactPath } from "./wasm.js";
import { verifyDependencyContract } from "./verify-dependency-contract.js";

export type ContractInspectResult = {
  contractName: string;
  network: string;
  artifact: {
    contractId: string;
    wasmHash: string;
    deployedAt: string;
    historyCount: number;
  };
  onChain: {
    reachable: boolean;
    detail?: string;
  };
  localWasm: {
    path: string;
    hash?: string;
    matchesArtifact: boolean;
  };
  dependencies: string[];
};

export type InspectContractOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  cwd?: string;
};

export async function inspectContract(
  options: InspectContractOptions
): Promise<ContractInspectResult> {
  const cwd = options.cwd ?? process.cwd();
  const contract = resolveContract(options.config, options.contractName, cwd);
  const network = resolveNetwork(options.config, options.networkName);
  const artifacts = await readArtifacts(cwd);
  const artifact = artifacts.networks[network.name]?.contracts[contract.name];

  if (!artifact) {
    throw new CaatingaError(
      `No deployed artifact found for "${contract.name}" on "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run ctg deploy before inspect."
    );
  }

  await checkBinary("stellar", "Install Stellar CLI before running ctg inspect.");

  let reachable = false;
  let detail: string | undefined;

  try {
    await verifyDependencyContract({
      dependencyName: contract.name,
      contractId: artifact.contractId,
      network,
      cwd,
    });
    reachable = true;
    detail = "Contract interface reachable on network.";
  } catch (error) {
    reachable = false;
    detail = error instanceof CaatingaError ? error.message : "Contract not reachable on network.";
    // #133 (bug 2): the reachability probe wraps the Stellar CLI failure in a
    // generic message and only forwards the original error as `cause`. Surface
    // that underlying CLI output (carried on the cause's hint) so an
    // unreachable result is diagnosable instead of a bare "not reachable".
    const cause = error instanceof CaatingaError ? error.cause : undefined;
    const cliOutput = cause instanceof CaatingaError ? cause.hint?.trim() : undefined;
    if (cliOutput) {
      detail = `${detail}\nStellar CLI: ${cliOutput}`;
    }
  }

  // #133 (bug 1): prefer the per-network artifact wasmPath (e.g. a mainnet build
  // under ./deploy/mainnet-wasm) over the config `wasm`, which always points at
  // the default (testnet) build output. Comparing the mainnet artifact hash
  // against the testnet WASM produced a false "Local WASM: differs or missing".
  // artifact.wasmPath is stored relative to the project root, so resolve it
  // against cwd (resolveWasmArtifactPath would otherwise resolve it against
  // process.cwd()).
  const localWasmSource = artifact.wasmPath
    ? path.resolve(cwd, artifact.wasmPath)
    : contract.wasmPath;
  const localWasmDisplayPath = artifact.wasmPath ?? contract.config.wasm;

  let localHash: string | undefined;
  try {
    const wasmPath = await resolveWasmArtifactPath(localWasmSource, {
      sourcePath: contract.sourcePath,
    });
    localHash = await hashWasm(wasmPath);
  } catch {
    localHash = undefined;
  }

  return {
    contractName: contract.name,
    network: network.name,
    artifact: {
      contractId: artifact.contractId,
      wasmHash: artifact.wasmHash,
      deployedAt: artifact.deployedAt,
      historyCount: artifact.history?.length ?? 0,
    },
    onChain: { reachable, detail },
    localWasm: {
      path: localWasmDisplayPath,
      hash: localHash,
      matchesArtifact: Boolean(localHash && localHash === artifact.wasmHash),
    },
    dependencies: artifact.dependencies ?? contract.config.dependsOn ?? [],
  };
}
