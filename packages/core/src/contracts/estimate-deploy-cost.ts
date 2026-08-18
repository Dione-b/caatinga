import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { formatConstructorCliArgs } from "./format-cli-args.js";
import { resolveDeployArgs, type DeployArgValue } from "./resolve-deploy-args.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { resolveContract } from "./resolve-contract.js";
import { resolveWasmArtifactPath } from "./wasm.js";

export type DeployCostEstimate = {
  contractName: string;
  network: string;
  wasmPath: string;
  inclusionFeeStroops?: number;
  resourceFeeStroops?: number;
  totalFeeStroops?: number;
  simulation: { ok: true } | { ok: false; error: string };
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

function formatConstructorCliArgsForEstimate(resolved: Record<string, DeployArgValue>): string[] {
  const args = formatConstructorCliArgs(resolved);
  return args.length > 0 ? ["--", ...args] : [];
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

  await checkBinary("stellar", "Install Stellar CLI before running ctg estimate.");

  const wasmPath = await resolveWasmArtifactPath(contract.wasmPath, {
    sourcePath: contract.sourcePath,
  });

  const artifacts = await readArtifacts(cwd);
  const rawDeployArgs = contract.config.deployArgs;
  const resolvedDeployArgs =
    Object.keys(rawDeployArgs).length > 0
      ? await resolveDeployArgs({
          deployArgs: rawDeployArgs,
          artifacts,
          network: network.name,
          source,
          cwd,
        })
      : {};

  const constructorArgs = formatConstructorCliArgsForEstimate(resolvedDeployArgs);

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
        error
      );
    }
    throw error;
  }

  const simulateArgs = ["tx", "simulate", "--source-account", source, buildOutput];
  let simulateOutput = "";
  let simulationError: string | undefined;

  try {
    const simulateResult = await runCommand("stellar", simulateArgs, {
      cwd,
      failureCode: CaatingaErrorCode.ESTIMATE_FAILED,
    });
    simulateOutput = simulateResult.all || `${simulateResult.stdout}\n${simulateResult.stderr}`;
  } catch (error) {
    simulationError = error instanceof Error ? error.message : String(error);
    simulateOutput = "";
  }

  const parsed = parseFeeStroops(simulateOutput);
  const resourceFeeStroops = parsed.resource;
  const inclusionFeeStroops = parsed.inclusion;
  const totalFeeStroops =
    inclusionFeeStroops === undefined ? undefined : inclusionFeeStroops + (resourceFeeStroops ?? 0);
  const simulation =
    simulationError || inclusionFeeStroops === undefined
      ? {
          ok: false as const,
          error: simulationError ?? "Simulation output did not contain a parseable inclusion fee.",
        }
      : { ok: true as const };
  const rawOutput = [buildOutput, simulateOutput, simulation.ok ? "" : simulation.error]
    .filter(Boolean)
    .join("\n");

  return {
    contractName: contract.name,
    network: network.name,
    wasmPath: path.relative(cwd, wasmPath) || wasmPath,
    inclusionFeeStroops,
    resourceFeeStroops,
    totalFeeStroops,
    simulation,
    advisory:
      simulation.ok
        ? "Advisory estimate only — actual fees may differ under network congestion or contract complexity."
        : "Fee estimate unavailable — simulation did not produce a parseable inclusion fee.",
    rawOutput,
  };
}
