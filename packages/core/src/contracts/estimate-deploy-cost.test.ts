import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

vi.mock("../shell/check-binary.js", () => ({
  checkBinary: vi.fn(async () => undefined),
}));

import { estimateDeployCost } from "./estimate-deploy-cost.js";

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
      dependsOn: [],
      deployArgs: {},
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
};

describe("estimateDeployCost", () => {
  let tmpDir: string;

  beforeEach(async () => {
    runCommand.mockReset();
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-estimate-"));
    const wasmDir = path.join(tmpDir, "contracts/counter/target/wasm32v1-none/release");
    await mkdir(wasmDir, { recursive: true });
    await writeFile(path.join(wasmDir, "counter.wasm"), Buffer.from([0, 1, 2]));

    const artifacts = createInitialArtifacts("app", { networks: ["testnet"] });
    artifacts.networks.testnet!.contracts.counter = {
      contractId: `C${"A".repeat(55)}`,
      wasmHash: "a".repeat(64),
      deployedAt: "2026-06-21T00:00:00.000Z",
      sourcePath: "./contracts/counter",
      wasmPath: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
      dependencies: [],
      resolvedDeployArgs: {},
    };
    await writeArtifacts(artifacts, tmpDir);
    await writeFile(path.join(tmpDir, "caatinga.config.ts"), "export default {}", "utf8");
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  /**
   * Shape of `stellar tx decode --output json` for the envelope `stellar tx simulate`
   * returned when deploying the counter template on testnet (stellar 27.0.0):
   * `fee` = inclusion (100) + resource (65756).
   */
  const decodedSimulatedEnvelope = JSON.stringify({
    tx: { tx: { fee: 65856, ext: { v1: { resource_fee: "65756" } } } },
  });

  function mockStellar(decoded: string = decodedSimulatedEnvelope): void {
    runCommand.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes("--build-only")) return { stdout: "AAAA", stderr: "", all: "AAAA" };
      if (args[1] === "simulate") return { stdout: "SIMULATED\n", stderr: "", all: "SIMULATED" };
      if (args[1] === "decode") return { stdout: decoded, stderr: "", all: decoded };
      return { stdout: "", stderr: "", all: "" };
    });
  }

  it("should_return_fee_breakdown_when_simulate_succeeds", async () => {
    mockStellar();

    const result = await estimateDeployCost({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.simulation).toEqual({ ok: true });
    expect(result.inclusionFeeStroops).toBe(100);
    expect(result.resourceFeeStroops).toBe(65756);
    expect(result.totalFeeStroops).toBe(65856);
    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      ["tx", "decode", "--output", "json", "SIMULATED"],
      expect.anything()
    );
  });

  it("should_simulate_against_the_selected_network", async () => {
    mockStellar();

    await estimateDeployCost({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    const simulateCall = runCommand.mock.calls.find(([, args]) => args[1] === "simulate");
    const simulateArgs = simulateCall?.[1] as string[];
    expect(simulateArgs.slice(4, 6)).toEqual(["--network", "testnet"]);
    expect(simulateArgs.at(-1)).toBe("AAAA");
  });

  it("should_throw_ESTIMATE_FAILED_when_build_only_fails", async () => {
    const original = new CaatingaError(
      "build failed",
      CaatingaErrorCode.ESTIMATE_FAILED,
      "fix wasm"
    );
    runCommand.mockRejectedValue(original);

    await expect(
      estimateDeployCost({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.ESTIMATE_FAILED,
      cause: original,
    });
  });

  it("should_mark_simulation_failure_as_unavailable", async () => {
    runCommand.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes("--build-only")) return { stdout: "AAAA", stderr: "", all: "AAAA" };
      throw new Error("simulation rejected");
    });

    const result = await estimateDeployCost({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.simulation).toEqual({ ok: false, error: "simulation rejected" });
    expect(result.inclusionFeeStroops).toBeUndefined();
    expect(result.totalFeeStroops).toBeUndefined();
    expect(result.rawOutput).toContain("simulation rejected");
  });

  it("should_mark_unparseable_simulation_output_as_unavailable", async () => {
    runCommand.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes("--build-only")) return { stdout: "AAAA", stderr: "", all: "AAAA" };
      return { stdout: "inclusion fee: 100\nresource fee: 5000", stderr: "", all: "" };
    });

    const result = await estimateDeployCost({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.simulation.ok).toBe(false);
    expect(result.totalFeeStroops).toBeUndefined();
    expect(result.advisory).toContain("unavailable");
  });
});
