import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CaatingaConfig } from "../config/config.schema.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";
import { evaluateEnvDrift } from "./evaluate-env-drift.js";
import { syncFrontendEnv } from "./sync-frontend-env.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("evaluateEnvDrift", () => {
  const config: CaatingaConfig = {
    project: "app",
    defaultNetwork: "testnet",
    contracts: {
      counter: {
        path: "./contracts/counter",
        wasm: "./rel/counter.wasm",
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
    frontend: {
      framework: "vite-react",
      bindingsOutput: "./src/gen",
      envFile: "./frontend/.env.local",
      env: {
        counter: "VITE_COUNTER_ID",
        rpcUrl: "VITE_RPC_URL",
      },
    },
  };

  async function seedArtifacts(cwd: string): Promise<void> {
    await writeArtifacts(
      {
        project: "app",
        version: 1,
        networks: {
          testnet: {
            contracts: {
              counter: {
                contractId: `C${"C".repeat(55)}`,
                wasmHash: "a".repeat(64),
                deployedAt: "2026-07-04T00:00:00.000Z",
                sourcePath: "./contracts/counter",
                wasmPath: "./rel/counter.wasm",
                dependencies: [],
                resolvedDeployArgs: {},
              },
            },
            dependencyGraph: { counter: [] },
          },
        },
      },
      cwd
    );
  }

  it("should_report_in_sync_when_env_matches_artifacts", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-env-drift-"));
    tempDirs.push(cwd);

    await seedArtifacts(cwd);
    await syncFrontendEnv({
      config,
      cwd,
    });

    const report = await evaluateEnvDrift({ config, cwd });
    expect(report?.inSync).toBe(true);
    expect(report?.drifts).toHaveLength(0);
  });

  it("should_report_drift_when_env_contract_id_differs", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-env-drift-"));
    tempDirs.push(cwd);

    await seedArtifacts(cwd);
    await syncFrontendEnv({ config, cwd });
    const envPath = path.join(cwd, "frontend/.env.local");
    const content = await readFile(envPath, "utf8");
    await writeFile(envPath, content.replace(/VITE_COUNTER_ID=.*/, "VITE_COUNTER_ID=STALE_ID"));

    const report = await evaluateEnvDrift({ config, cwd });
    expect(report?.inSync).toBe(false);
    expect(report?.drifts.some((entry) => entry.envKey === "VITE_COUNTER_ID")).toBe(true);
  });

  it("should_return_null_when_frontend_env_is_not_configured", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-env-drift-"));
    tempDirs.push(cwd);

    const report = await evaluateEnvDrift({
      config: { ...config, frontend: undefined },
      cwd,
    });

    expect(report).toBeNull();
  });
});
