import type { CaatingaConfig, ExpectSpec, SmokeRead } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { resolveMethodArgs } from "./resolve-method-args.js";
import { withFreshSmokeArgs } from "./smoke-args.js";
import { readContract } from "./read-contract.js";
import { assertExpect } from "./verify-expect.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { formatNamedCliArgs } from "./format-cli-args.js";

export type RunSmokeReadsOptions = {
  config: CaatingaConfig;
  networkName?: string;
  source?: string;
  cwd?: string;
  reads?: SmokeRead[];
};

export type SmokeReadResult = {
  contract: string;
  method: string;
  result?: string;
  passed: boolean;
};

function collectSmokeReads(config: CaatingaConfig, reads?: SmokeRead[]): SmokeRead[] {
  if (reads && reads.length > 0) {
    return reads;
  }

  if (config.smoke?.reads && config.smoke.reads.length > 0) {
    return config.smoke.reads;
  }

  return (config.postDeployRead ?? []).map((hook) => ({
    contract: hook.contract,
    method: hook.method,
    args: hook.args,
    source: hook.source,
    expect: hook.expect,
  }));
}

async function resolveSmokeExpect(
  read: SmokeRead,
  options: {
    artifacts: Awaited<ReturnType<typeof readArtifacts>>;
    network: string;
    source: string;
    cwd: string;
  }
): Promise<ExpectSpec | undefined> {
  if (read.expect === undefined) {
    return { matcher: "reachable" };
  }

  if (typeof read.expect === "string" && read.expect.includes("${")) {
    const resolved = await resolveDeployArgs({
      deployArgs: { expected: read.expect },
      artifacts: options.artifacts,
      network: options.network,
      source: options.source,
      cwd: options.cwd,
    });
    return String(resolved.expected);
  }

  return read.expect;
}

export async function runSmokeReads(options: RunSmokeReadsOptions): Promise<SmokeReadResult[]> {
  const cwd = options.cwd ?? process.cwd();
  const reads = collectSmokeReads(options.config, options.reads);

  if (reads.length === 0) {
    throw new CaatingaError(
      "No smoke reads configured.",
      CaatingaErrorCode.INVALID_CONFIG,
      "Add smoke.reads or postDeployRead entries to caatinga.config.ts."
    );
  }

  const network = resolveNetwork(options.config, options.networkName);
  const defaultSource = assertSafeSourceAccount(options.source);
  const artifacts = await readArtifacts(cwd);
  const results: SmokeReadResult[] = [];

  for (const read of reads) {
    const readSource = read.source ? assertSafeSourceAccount(read.source) : defaultSource;
    const readArgs = options.config.smoke?.useFreshSymbol
      ? withFreshSmokeArgs(read.args)
      : read.args;

    const resolvedArgs = await resolveDeployArgs({
      deployArgs: readArgs,
      artifacts,
      network: network.name,
      source: readSource,
      cwd,
    });

    const methodArgs = await resolveMethodArgs({
      args: resolvedArgs,
      source: readSource,
      cwd,
    });

    const readResult = await readContract({
      config: options.config,
      target: `${read.contract}.${read.method}`,
      args: formatNamedCliArgs(methodArgs),
      networkName: network.name,
      source: readSource,
      cwd,
    });

    const output = readResult.result?.trim() ?? "";
    const expectSpec = await resolveSmokeExpect(read, {
      artifacts,
      network: network.name,
      source: readSource,
      cwd,
    });

    let passed = true;
    if (expectSpec !== undefined) {
      try {
        assertExpect(output, expectSpec, `"${read.contract}.${read.method}"`);
      } catch {
        passed = false;
      }
    }

    results.push({
      contract: read.contract,
      method: read.method,
      result: output || undefined,
      passed,
    });
  }

  return results;
}

export function summarizeReadOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return "(empty)";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const sample = parsed.slice(0, 3);
      return `array length=${parsed.length} sample=${JSON.stringify(sample)}`;
    }
  } catch {
    // not JSON — fall through
  }

  if (trimmed.length > 120) {
    return `${trimmed.slice(0, 117)}...`;
  }

  return trimmed;
}
