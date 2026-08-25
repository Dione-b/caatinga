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

  it("should_return_fee_breakdown_when_simulate_succeeds", async () => {
    runCommand.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes("--build-only")) {
        return { stdout: "AAAA", stderr: "", all: "AAAA" };
      }
      if (args[0] === "tx") {
        return {
          stdout: "inclusion fee: 100\nresource fee: 5000",
          stderr: "",
          all: "inclusion fee: 100\nresource fee: 5000",
        };
      }
      return { stdout: "", stderr: "", all: "" };
    });

    const result = await estimateDeployCost({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.totalFeeStroops).toBe(5100);
    expect(result.inclusionFeeStroops).toBe(100);
    expect(result.resourceFeeStroops).toBe(5000);
  });

  it("should_throw_ESTIMATE_FAILED_when_build_only_fails", async () => {
    const original = new CaatingaError("build failed", CaatingaErrorCode.ESTIMATE_FAILED, "fix wasm");
    runCommand.mockRejectedValue(
      original
    );

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
      return { stdout: "completed", stderr: "", all: "completed" };
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
