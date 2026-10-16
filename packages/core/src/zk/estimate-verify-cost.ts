/**
 * Resource-budget estimates for on-chain Groth16 verification on Soroban.
 *
 * These are *estimates*, not measurements of your circuit. The model is fitted
 * to simulations of the Caatinga verifier on testnet (protocol 29) for 1 to 104
 * public signals, produced by `scripts/zk-verify-benchmark.mjs`; it lands within
 * 0.2% of every measured point and rounds up. Verification cost depends on the
 * public-signal count only — the pairing check is fixed and each public signal
 * adds one G1 multiplication — not on the number of constraints. Treat it as a
 * pre-flight signal, never as a fee quote.
 */

/** CPU instructions for verifying a proof with zero public signals. */
export const ZK_BASE_CPU_INSTRUCTIONS = 40_500_000;

/** Additional CPU instructions per public signal (one G1 mul + add). */
export const ZK_CPU_INSTRUCTIONS_PER_PUBLIC_INPUT = 3_560_000;

/** Memory used by the pairing check, in bytes. */
export const ZK_BASE_MEMORY_BYTES = 294 * 1024;

/**
 * Per-transaction Soroban limits, in instructions and bytes: `tx_max_instructions`
 * and `tx_memory_limit` from the `contract_compute_v0` network setting, identical
 * on testnet and mainnet as read with `stellar network settings` (2026-10, protocol 29).
 *
 * They are not fetched at runtime because the RPC `getNetwork` response does not
 * carry them. When the network raises them, this table is the single place to update.
 */
export const SOROBAN_NETWORK_LIMITS = {
  cpuInstructions: 400_000_000,
  memoryBytes: 41_943_040,
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
