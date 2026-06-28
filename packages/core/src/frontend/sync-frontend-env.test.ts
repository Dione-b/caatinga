import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";
import { syncFrontendEnv } from "./sync-frontend-env.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) =>
        import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }))
      )
  );
});

describe("syncFrontendEnv", () => {
  const config: CaatingaConfig = {
    project: "stellar-album",
    defaultNetwork: "testnet",
    contracts: {
      coin: {
        path: "./contracts/coin",
        wasm: "./target/wasm32v1-none/release/coin.wasm",
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
      bindingsOutput: "./frontend/src/contracts",
      envFile: "./frontend/.env.local",
      env: {
        coin: "VITE_COIN",
        rpcUrl: "VITE_RPC_URL",
        networkPassphrase: "VITE_NETWORK_PASSPHRASE",
      },
    },
  };

  it("writes contract and network values to the configured env file", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-sync-env-"));
    tempDirs.push(cwd);

    await writeArtifacts(
      {
        project: "stellar-album",
        version: 1,
        networks: {
          testnet: {
            contracts: {
              coin: {
                contractId: "CCOINCONTRACTID",
                wasmHash: "hash",
                deployedAt: "2026-06-25T00:00:00.000Z",
                sourcePath: "./contracts/coin",
                wasmPath: "./target/wasm32v1-none/release/coin.wasm",
                dependencies: [],
                resolvedDeployArgs: {},
              },
            },
            dependencyGraph: { coin: [] },
          },
        },
      },
      cwd
    );

    const result = await syncFrontendEnv({ config, cwd });
    const contents = await readFile(result.envFile, "utf8");

    expect(result.entries).toEqual([
      { key: "VITE_COIN", value: "CCOINCONTRACTID" },
      { key: "VITE_RPC_URL", value: "https://soroban-testnet.stellar.org" },
      { key: "VITE_NETWORK_PASSPHRASE", value: "Test SDF Network ; September 2015" },
    ]);
    expect(contents).toContain("VITE_COIN=CCOINCONTRACTID");
    expect(contents).toContain("VITE_RPC_URL=https://soroban-testnet.stellar.org");
    expect(contents).toContain('VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"');
  });

  it("writes wasmHash values when source key uses .wasmHash suffix", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-sync-env-"));
    tempDirs.push(cwd);

    const wasmHashConfig: CaatingaConfig = {
      ...config,
      frontend: {
        framework: "vite-react",
        bindingsOutput: "./frontend/src/contracts",
        envFile: "./frontend/.env.local",
        env: {
          coin: "VITE_COIN",
          "coin.wasmHash": "VITE_COIN_WASM_HASH",
          rpcUrl: "VITE_RPC_URL",
        },
      },
    };

    await writeArtifacts(
      {
        project: "stellar-album",
        version: 1,
        networks: {
          testnet: {
            contracts: {
              coin: {
                contractId: "CCOINCONTRACTID",
                wasmHash: "abcdef1234567890",
                deployedAt: "2026-06-25T00:00:00.000Z",
                sourcePath: "./contracts/coin",
                wasmPath: "./target/wasm32v1-none/release/coin.wasm",
                dependencies: [],
                resolvedDeployArgs: {},
              },
            },
            dependencyGraph: { coin: [] },
          },
        },
      },
      cwd
    );

    const result = await syncFrontendEnv({ config: wasmHashConfig, cwd });
    const contents = await readFile(result.envFile, "utf8");

    expect(result.entries).toEqual([
      { key: "VITE_COIN", value: "CCOINCONTRACTID" },
      { key: "VITE_COIN_WASM_HASH", value: "abcdef1234567890" },
      { key: "VITE_RPC_URL", value: "https://soroban-testnet.stellar.org" },
    ]);
    expect(contents).toContain("VITE_COIN_WASM_HASH=abcdef1234567890");
  });

  it("fails when .wasmHash source key references unknown contract", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-sync-env-"));
    tempDirs.push(cwd);

    const badConfig: CaatingaConfig = {
      ...config,
      frontend: {
        framework: "vite-react",
        bindingsOutput: "./frontend/src/contracts",
        envFile: "./frontend/.env.local",
        env: {
          "unknown.wasmHash": "VITE_UNKNOWN_HASH",
        },
      },
    };

    await writeArtifacts(
      {
        project: "stellar-album",
        version: 1,
        networks: {
          testnet: {
            contracts: {},
            dependencyGraph: {},
          },
        },
      },
      cwd
    );

    await expect(syncFrontendEnv({ config: badConfig, cwd })).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACT_NOT_FOUND,
    });
  });

  it("fails when frontend env sync is not configured", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-sync-env-"));
    tempDirs.push(cwd);

    await expect(
      syncFrontendEnv({
        config: {
          ...config,
          frontend: {
            framework: "vite-react",
            bindingsOutput: "./frontend/src/contracts",
          },
        },
        cwd,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.INVALID_CONFIG });
  });
});
