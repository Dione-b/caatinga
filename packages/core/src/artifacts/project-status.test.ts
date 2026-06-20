import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { writeBindingMarker } from "../bindings/binding-marker.js";
import { collectProjectStatus } from "./project-status.js";

const CONTRACT_ID = `C${"2".repeat(55)}`;

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./rel/counter.wasm",
      dependsOn: [],
      deployArgs: {},
    },
    token: {
      path: "./contracts/token",
      wasm: "./rel/token.wasm",
      dependsOn: ["counter"],
      deployArgs: {},
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    mainnet: {
      rpcUrl: "https://soroban.stellar.org",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./src/gen" },
};

async function writeDeployedCounter(tmpDir: string): Promise<void> {
  const artifacts = createInitialArtifacts("app");
  artifacts.networks.testnet = {
    contracts: {
      counter: {
        contractId: CONTRACT_ID,
        wasmHash: "abc",
        deployedAt: "2026-06-11T12:00:00.000Z",
        sourcePath: "./contracts/counter",
        wasmPath: "./rel/counter.wasm",
        dependencies: [],
        resolvedDeployArgs: {},
      },
    },
    dependencyGraph: {},
  };
  await writeArtifacts(artifacts, tmpDir);
}

describe("collectProjectStatus", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("lists all configured contracts marking undeployed ones", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-status-"));
    await writeDeployedCounter(tmpDir);

    const status = await collectProjectStatus({
      config: baseConfig,
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(status.project).toBe("app");
    expect(status.networks).toHaveLength(1);
    const [testnet] = status.networks;
    expect(testnet.network).toBe("testnet");

    const counter = testnet.contracts.find((entry) => entry.name === "counter");
    expect(counter).toMatchObject({
      deployed: true,
      contractId: CONTRACT_ID,
      wasmHash: "abc",
    });

    const token = testnet.contracts.find((entry) => entry.name === "token");
    expect(token).toMatchObject({
      deployed: false,
      dependencies: ["counter"],
      bindings: { status: "missing" },
    });
  });

  it("reports binding freshness from markers", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-status-"));
    await writeDeployedCounter(tmpDir);

    const outputDir = path.join(tmpDir, "src/gen/counter");
    await mkdir(path.join(outputDir, "src"), { recursive: true });
    await writeFile(path.join(outputDir, "src", "index.ts"), "export class Client {}\n", "utf8");
    await writeBindingMarker(outputDir, {
      version: 1,
      contractId: CONTRACT_ID,
      wasmHash: "abc",
      network: "testnet",
      generatedAt: "2026-06-11T12:00:00.000Z",
    });

    const status = await collectProjectStatus({
      config: baseConfig,
      networkName: "testnet",
      cwd: tmpDir,
    });

    const counter = status.networks[0].contracts.find((entry) => entry.name === "counter");
    expect(counter?.bindings.status).toBe("fresh");
  });

  it("falls back to the default network when artifacts are empty", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-status-empty-"));
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    const status = await collectProjectStatus({ config: baseConfig, cwd: tmpDir });

    expect(status.networks.map((entry) => entry.network)).toEqual(["testnet"]);
    expect(status.networks[0].contracts.every((entry) => !entry.deployed)).toBe(true);
  });

  it("throws CAATINGA_NETWORK_NOT_FOUND for unknown network", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-status-"));
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    await expect(
      collectProjectStatus({ config: baseConfig, networkName: "devnet", cwd: tmpDir })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.NETWORK_NOT_FOUND });
  });
});
