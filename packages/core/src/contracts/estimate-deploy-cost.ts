import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { resolveDeployArgs, type DeployArgValue } from "./resolve-deploy-args.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { resolveContract } from "./resolve-contract.js";
import { resolveWasmArtifactPath } from "./wasm.js";

export type DeployCostEstimate = {
  contractName: string;
  network: string;
  wasmPath: string;
  inclusionFeeStroops: number;
  resourceFeeStroops?: number;
  totalFeeStroops: number;
  advisory: string;
  rawOutput?: string;
};

export type EstimateDeployCostOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  source?: string;
  cwd?: string;
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

function parseFeeStroops(output: string): { inclusion?: number; resource?: number } {
  const inclusionMatch = output.match(/inclusion[_\s-]*fee[:\s]+(\d+)/i);
  const resourceMatch = output.match(/resource[_\s-]*fee[:\s]+(\d+)/i);
  const totalMatch = output.match(/total[_\s-]*fee[:\s]+(\d+)/i);

  return {
    inclusion: inclusionMatch ? Number(inclusionMatch[1]) : undefined,
    resource: resourceMatch ? Number(resourceMatch[1]) : undefined,
    ...(totalMatch && !resourceMatch ? { resource: Number(totalMatch[1]) } : {}),
  };
}

export async function estimateDeployCost(
  options: EstimateDeployCostOptions
): Promise<DeployCostEstimate> {
  const cwd = options.cwd ?? process.cwd();
  const contract = resolveContract(options.config, options.contractName, cwd);
  const network = resolveNetwork(options.config, options.networkName);
  const source = assertSafeSourceAccount(options.source);

  await checkBinary("stellar", "Install Stellar CLI before running caatinga estimate.");

  const wasmPath = await resolveWasmArtifactPath(contract.wasmPath, {
    sourcePath: contract.sourcePath,
  });

  const artifacts = await readArtifacts(cwd);
  const rawDeployArgs = contract.config.deployArgs;
  const resolvedDeployArgs =
    Object.keys(rawDeployArgs).length > 0
      ? resolveDeployArgs({
          deployArgs: rawDeployArgs,
          artifacts,
          network: network.name,
        })
      : {};

  const constructorArgs = formatConstructorCliArgs(resolvedDeployArgs);

  const deployArgs = [
    "contract",
    "deploy",
    "--wasm",
    wasmPath,
    "--source-account",
    source,
    "--build-only",
    ...buildStellarNetworkArgs(network),
    ...constructorArgs,
  ];

  let buildOutput: string;
  try {
    const buildResult = await runCommand("stellar", deployArgs, {
      cwd,
      failureCode: CaatingaErrorCode.ESTIMATE_FAILED,
    });
    buildOutput = (buildResult.stdout || buildResult.all).trim();
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw new CaatingaError(
        `Deploy cost estimate failed for "${contract.name}".`,
        CaatingaErrorCode.ESTIMATE_FAILED,
        error.hint ?? "Ensure WASM is built and deploy args resolve correctly.",
        error.cause
      );
    }
    throw error;
  }

  const simulateArgs = ["tx", "simulate", "--source-account", source, buildOutput];
  let simulateOutput = "";

  try {
    const simulateResult = await runCommand("stellar", simulateArgs, {
      cwd,
      failureCode: CaatingaErrorCode.ESTIMATE_FAILED,
    });
    simulateOutput = simulateResult.all || `${simulateResult.stdout}\n${simulateResult.stderr}`;
  } catch {
    simulateOutput = "";
  }

  const parsed = parseFeeStroops(simulateOutput);
  const inclusionFeeStroops = parsed.inclusion ?? 100;
  const resourceFeeStroops = parsed.resource;
  const totalFeeStroops = inclusionFeeStroops + (resourceFeeStroops ?? 0);

  return {
    contractName: contract.name,
    network: network.name,
    wasmPath: path.relative(cwd, wasmPath) || wasmPath,
    inclusionFeeStroops,
    resourceFeeStroops,
    totalFeeStroops,
    advisory:
      "Advisory estimate only — actual fees may differ under network congestion or contract complexity.",
    rawOutput: simulateOutput || buildOutput,
  };
}
