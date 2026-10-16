/**
 * Resource-budget estimates for on-chain Groth16 verification on Soroban.
 *
 * These are *estimates*, not measurements. They come from the reference
 * `groth16_verifier` budget report and are the only numbers Caatinga can offer
 * without executing the verifier contract. Treat them as a pre-flight signal
 * for "this circuit is far too big", never as a fee quote — run
 * `env.cost_estimate().budget().print()` in the contract tests for numbers that
 * reflect your circuit shape.
 */

/**
 * CPU instructions for a single public signal, from the reference
 * `groth16_verifier` budget report.
 */
export const ZK_BASE_CPU_INSTRUCTIONS = 41_000_000;

/** Additional CPU instructions per public input beyond the first. */
export const ZK_CPU_INSTRUCTIONS_PER_PUBLIC_INPUT = 2_460_000;

/** Memory used by the pairing check, in bytes. */
export const ZK_BASE_MEMORY_BYTES = 294 * 1024;

/**
 * Reference network limits, in instructions and bytes.
 *
 * These are the Soroban network settings as documented by Stellar; they are not
 * fetched from the network because the RPC `getNetwork` response does not carry
 * them. When Stellar raises them, this table is the single place to update.
 */
export const SOROBAN_NETWORK_LIMITS = {
  cpuInstructions: 100_000_000,
  memoryBytes: 16_777_216,
} as const;

/**
 * Utilization at or above which the CLI emits a warning. Below the limit but
 * close to it, a slightly larger circuit (or one more public input) is enough
 * to fail at deploy time, so the ramp is worth calling out.
 */
export const ZK_WARN_UTILIZATION = 0.8;

export type ZkVerifyCostEstimate = {
  circuitName: string;
  publicSignals: number;
  cpuInstructions: number;
  memoryBytes: number;
  limitCpuInstructions: number;
  limitMemoryBytes: number;
  cpuUtilization: number;
  memoryUtilization: number;
  /** Warnings for utilizations that are already close to, or past, the limit. */
  advisories: string[];
};

type EstimateZkVerifyCostOptions = {
  circuitName: string;
  publicSignals: number;
  limits?: {
    cpuInstructions: number;
    memoryBytes: number;
  };
};

export function estimateZkVerifyCost(options: EstimateZkVerifyCostOptions): ZkVerifyCostEstimate {
  const publicSignals = Math.max(0, Math.trunc(options.publicSignals));
  const limits = options.limits ?? SOROBAN_NETWORK_LIMITS;

  const cpuInstructions =
    ZK_BASE_CPU_INSTRUCTIONS + publicSignals * ZK_CPU_INSTRUCTIONS_PER_PUBLIC_INPUT;
  const memoryBytes = ZK_BASE_MEMORY_BYTES;

  const cpuUtilization = cpuInstructions / limits.cpuInstructions;
  const memoryUtilization = memoryBytes / limits.memoryBytes;

  const advisories: string[] = [];
  const describe = (label: string, utilization: number): string =>
    `${label} is at ${(utilization * 100).toFixed(1)}% of the reference limit`;

  if (cpuUtilization > 1) {
    advisories.push(
      `${describe("CPU", cpuUtilization)}. Reduce public signals or constraints before deploying.`
    );
  } else if (cpuUtilization >= ZK_WARN_UTILIZATION) {
    advisories.push(
      `${describe("CPU", cpuUtilization)}. Additional public inputs may push it over the limit.`
    );
  }

  if (memoryUtilization > 1) {
    advisories.push(`${describe("memory", memoryUtilization)}.`);
  } else if (memoryUtilization >= ZK_WARN_UTILIZATION) {
    advisories.push(`${describe("memory", memoryUtilization)}.`);
  }

  return {
    circuitName: options.circuitName,
    publicSignals,
    cpuInstructions,
    memoryBytes,
    limitCpuInstructions: limits.cpuInstructions,
    limitMemoryBytes: limits.memoryBytes,
    cpuUtilization,
    memoryUtilization,
    advisories,
  };
}

export function formatZkVerifyCostEstimate(estimate: ZkVerifyCostEstimate): string[] {
  const cpu = `${estimate.cpuInstructions.toLocaleString("en-US")} / ${estimate.limitCpuInstructions.toLocaleString("en-US")} insn (${(estimate.cpuUtilization * 100).toFixed(1)}%)`;
  const memory = `${(estimate.memoryBytes / 1024).toFixed(0)} KB / ${(estimate.limitMemoryBytes / 1024).toFixed(0)} KB (${(estimate.memoryUtilization * 100).toFixed(1)}%)`;

  return [
    `Estimates for verifying circuit "${estimate.circuitName}" with ${estimate.publicSignals} public signal(s):`,
    `  CPU:     ${cpu}`,
    `  Memory:  ${memory}`,
  ];
}
