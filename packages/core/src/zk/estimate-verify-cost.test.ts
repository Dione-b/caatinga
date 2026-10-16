import { describe, expect, it } from "vitest";
import {
  estimateZkVerifyCost,
  formatZkVerifyCostEstimate,
  SOROBAN_NETWORK_LIMITS,
  ZK_BASE_CPU_INSTRUCTIONS,
  ZK_BASE_MEMORY_BYTES,
  ZK_CPU_INSTRUCTIONS_PER_PUBLIC_INPUT,
  ZK_WARN_UTILIZATION,
} from "./estimate-verify-cost.js";

describe("estimateZkVerifyCost", () => {
  it("should_use_the_base_cost_for_a_single_public_signal", () => {
    const estimate = estimateZkVerifyCost({ circuitName: "main", publicSignals: 1 });

    expect(estimate.cpuInstructions).toBe(
      ZK_BASE_CPU_INSTRUCTIONS + ZK_CPU_INSTRUCTIONS_PER_PUBLIC_INPUT
    );
    expect(estimate.memoryBytes).toBe(ZK_BASE_MEMORY_BYTES);
  });

  it("should_add_the_per_input_cost_for_each_additional_public_signal", () => {
    const withOne = estimateZkVerifyCost({ circuitName: "main", publicSignals: 1 });
    const withThree = estimateZkVerifyCost({ circuitName: "main", publicSignals: 3 });

    expect(withThree.cpuInstructions - withOne.cpuInstructions).toBe(
      2 * ZK_CPU_INSTRUCTIONS_PER_PUBLIC_INPUT
    );
  });

  it("should_report_utilization_against_the_reference_limits", () => {
    const estimate = estimateZkVerifyCost({ circuitName: "main", publicSignals: 0 });

    expect(estimate.cpuUtilization).toBeCloseTo(
      ZK_BASE_CPU_INSTRUCTIONS / SOROBAN_NETWORK_LIMITS.cpuInstructions
    );
    expect(estimate.memoryUtilization).toBeCloseTo(
      ZK_BASE_MEMORY_BYTES / SOROBAN_NETWORK_LIMITS.memoryBytes
    );
  });

  it("should_honour_overridden_limits", () => {
    // A tiny budget makes even the base cost exceed the limit.
    const estimate = estimateZkVerifyCost({
      circuitName: "main",
      publicSignals: 0,
      limits: { cpuInstructions: 1_000, memoryBytes: 1_000 },
    });

    expect(estimate.cpuUtilization).toBeGreaterThan(1);
    expect(estimate.limitCpuInstructions).toBe(1_000);
    expect(estimate.advisories.length).toBeGreaterThan(0);
    expect(estimate.advisories.join(" ")).toContain("Reduce public signals");
  });

  it("should_warn_close_above_the_ramp_but_not_below_it", () => {
    // Derive the limits from the CPU figure the model actually produces, so the
    // ramp is exercised against the real base cost rather than a hardcoded one.
    const hugeMemory = 10 ** 12;
    const cpu = ZK_BASE_CPU_INSTRUCTIONS;

    const justBelow = estimateZkVerifyCost({
      circuitName: "main",
      publicSignals: 0,
      limits: { cpuInstructions: cpu / (ZK_WARN_UTILIZATION - 0.01), memoryBytes: hugeMemory },
    });
    const justAbove = estimateZkVerifyCost({
      circuitName: "main",
      publicSignals: 0,
      limits: { cpuInstructions: cpu / (ZK_WARN_UTILIZATION + 0.01), memoryBytes: hugeMemory },
    });

    expect(justBelow.cpuUtilization).toBeLessThan(ZK_WARN_UTILIZATION);
    expect(justBelow.advisories.filter((a) => a.includes("CPU"))).toEqual([]);

    expect(justAbove.cpuUtilization).toBeGreaterThan(ZK_WARN_UTILIZATION);
    expect(justAbove.advisories.filter((a) => a.includes("CPU")).length).toBe(1);
  });

  it("should_report_memory_warnings_when_the_budget_is_tight", () => {
    const estimate = estimateZkVerifyCost({
      circuitName: "main",
      publicSignals: 0,
      limits: { cpuInstructions: 10 ** 12, memoryBytes: ZK_BASE_MEMORY_BYTES * 0.9 },
    });

    expect(estimate.memoryUtilization).toBeGreaterThan(1);
    expect(estimate.advisories.some((a) => a.includes("memory"))).toBe(true);
  });

  it("should_not_warn_when_the_budget_is_comfortable", () => {
    const estimate = estimateZkVerifyCost({ circuitName: "main", publicSignals: 1 });

    expect(estimate.advisories).toEqual([]);
  });

  it("should_treat_a_negative_public_signal_count_as_zero", () => {
    const estimate = estimateZkVerifyCost({ circuitName: "main", publicSignals: -3 });

    expect(estimate.publicSignals).toBe(0);
  });
});

describe("formatZkVerifyCostEstimate", () => {
  it("should_render_cpu_and_memory_lines_with_utilisation", () => {
    const estimate = estimateZkVerifyCost({ circuitName: "main", publicSignals: 2 });
    const lines = formatZkVerifyCostEstimate(estimate).join("\n");

    expect(lines).toContain('circuit "main" with 2 public signal(s)');
    expect(lines).toContain("CPU:");
    expect(lines).toContain("insn");
    expect(lines).toContain("Memory:");
    expect(lines).toContain("%");
  });

  // Simulated `verify_proof` cost on testnet (protocol 29, 2026-10), measured with
  // scripts/zk-verify-benchmark.mjs. The model must never undershoot a measurement
  // by more than 0.5% — an estimate that reads low is the one that lets a circuit
  // fail at deploy time.
  it.each([
    [1, 44_038_142],
    [2, 47_594_581],
    [4, 54_707_459],
    [8, 68_933_213],
    [16, 97_384_723],
    [32, 154_287_742],
    [64, 268_093_781],
    [96, 381_899_819],
    [104, 410_351_328],
  ])("should_track_the_measured_cost_for_%i_public_signals", (publicSignals, measured) => {
    const { cpuInstructions } = estimateZkVerifyCost({ circuitName: "main", publicSignals });

    expect(cpuInstructions).toBeGreaterThanOrEqual(measured * 0.995);
    expect(cpuInstructions).toBeLessThanOrEqual(measured * 1.02);
  });

  it("should_flag_more_than_100_public_signals_as_over_the_transaction_limit", () => {
    // 112 public signals failed simulation on testnet; 104 was the largest that passed.
    const over = estimateZkVerifyCost({ circuitName: "main", publicSignals: 112 });
    const under = estimateZkVerifyCost({ circuitName: "main", publicSignals: 80 });

    expect(over.cpuUtilization).toBeGreaterThan(1);
    expect(under.cpuUtilization).toBeLessThan(1);
  });
});
