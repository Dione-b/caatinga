import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { writeBindingMarker } from "./binding-marker.js";
import { evaluateBindingFreshness, evaluateBindingsFreshness } from "./binding-freshness.js";

const CONTRACT_ID = `C${"2".repeat(55)}`;

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./rel/counter.wasm",
      dependsOn: [],
      deployArgs: {}
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: { framework: "vite-react", bindingsOutput: "./src/gen" }
};

function artifactsWith(contractId: string, wasmHash: string): CaatingaArtifacts {
  return {
    project: "app",
    version: 1,
    networks: {
      testnet: {
        contracts: {
          counter: {
            contractId,
            wasmHash,
            deployedAt: "2026-06-11T12:00:00.000Z",
            sourcePath: "./contracts/counter",
            wasmPath: "./rel/counter.wasm",
            dependencies: [],
            resolvedDeployArgs: {}
          }
        },
        dependencyGraph: {}
      }
    }
  };
}

async function seedGeneratedBindings(tmpDir: string): Promise<string> {
  const outputDir = path.join(tmpDir, "src/gen/counter");
  await mkdir(path.join(outputDir, "src"), { recursive: true });
  await writeFile(path.join(outputDir, "src", "index.ts"), "export class Client {}\n", "utf8");
  return outputDir;
}

describe("evaluateBindingFreshness", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_report_fresh_when_marker_matches_artifact", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));
    const outputDir = await seedGeneratedBindings(tmpDir);
    await writeBindingMarker(outputDir, {
      version: 1,
      contractId: CONTRACT_ID,
      wasmHash: "abc",
      network: "testnet",
      generatedAt: "2026-06-11T12:00:00.000Z"
    });

    const result = await evaluateBindingFreshness({
      config: baseConfig,
      artifacts: artifactsWith(CONTRACT_ID, "abc"),
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.status).toBe("fresh");
    expect(result.marker?.wasmHash).toBe("abc");
  });

  it("should_report_stale_when_wasm_hash_differs", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));
    const outputDir = await seedGeneratedBindings(tmpDir);
    await writeBindingMarker(outputDir, {
      version: 1,
      contractId: CONTRACT_ID,
      wasmHash: "old-hash",
      network: "testnet",
      generatedAt: "2026-06-11T12:00:00.000Z"
    });

    const result = await evaluateBindingFreshness({
      config: baseConfig,
      artifacts: artifactsWith(CONTRACT_ID, "new-hash"),
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.status).toBe("stale");
    expect(result.reason).toContain("wasmHash");
  });

  it("should_report_stale_when_contract_id_differs", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));
    const outputDir = await seedGeneratedBindings(tmpDir);
    await writeBindingMarker(outputDir, {
      version: 1,
      contractId: `C${"3".repeat(55)}`,
      wasmHash: "abc",
      network: "testnet",
      generatedAt: "2026-06-11T12:00:00.000Z"
    });

    const result = await evaluateBindingFreshness({
      config: baseConfig,
      artifacts: artifactsWith(CONTRACT_ID, "abc"),
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.status).toBe("stale");
    expect(result.reason).toContain("contractId");
  });

  it("should_report_missing_when_output_dir_absent", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));

    const result = await evaluateBindingFreshness({
      config: baseConfig,
      artifacts: artifactsWith(CONTRACT_ID, "abc"),
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.status).toBe("missing");
  });

  it("should_report_missing_when_contract_not_deployed", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));
    await seedGeneratedBindings(tmpDir);

    const result = await evaluateBindingFreshness({
      config: baseConfig,
      artifacts: { project: "app", version: 1, networks: {} },
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.status).toBe("missing");
    expect(result.reason).toContain("not deployed");
  });

  it("should_report_unknown_when_frontend_config_is_absent", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));
    const { frontend, ...zkOnlyConfig } = baseConfig;

    const result = await evaluateBindingFreshness({
      config: zkOnlyConfig,
      artifacts: artifactsWith(CONTRACT_ID, "abc"),
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result).toMatchObject({
      contractName: "counter",
      status: "unknown",
      outputDir: "",
      marker: null,
      reason: "frontend bindings are not configured",
      // Lets callers point at the config fix rather than suggesting `generate`, which
      // cannot run in this state (#104).
      frontendUnconfigured: true
    });
  });

  it("should_report_unknown_when_bindings_exist_without_marker", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-"));
    await seedGeneratedBindings(tmpDir);

    const result = await evaluateBindingFreshness({
      config: baseConfig,
      artifacts: artifactsWith(CONTRACT_ID, "abc"),
      networkName: "testnet",
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.status).toBe("unknown");
  });
});

describe("evaluateBindingsFreshness", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_evaluate_every_deployed_contract_on_network", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-all-"));
    const outputDir = await seedGeneratedBindings(tmpDir);
    await writeBindingMarker(outputDir, {
      version: 1,
      contractId: CONTRACT_ID,
      wasmHash: "abc",
      network: "testnet",
      generatedAt: "2026-06-11T12:00:00.000Z"
    });

    const results = await evaluateBindingsFreshness({
      config: baseConfig,
      artifacts: artifactsWith(CONTRACT_ID, "abc"),
      networkName: "testnet",
      cwd: tmpDir
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ contractName: "counter", status: "fresh" });
  });

  it("should_return_empty_for_network_without_deployments", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-fresh-all-"));

    const results = await evaluateBindingsFreshness({
      config: baseConfig,
      artifacts: { project: "app", version: 1, networks: {} },
      networkName: "testnet",
      cwd: tmpDir
    });

    expect(results).toEqual([]);
  });
});
