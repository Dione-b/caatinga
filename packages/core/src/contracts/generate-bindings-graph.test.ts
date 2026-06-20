import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import { generateBindingsGraph } from "./generate-bindings-graph.js";

const CONTRACT_ID = `C${"2".repeat(55)}`;
const TOKEN_ID = `C${"3".repeat(55)}`;

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
    token: { path: "./contracts/token", wasm: "./rel/token.wasm", dependsOn: [], deployArgs: {} },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./src/gen" },
};

function deployedArtifact(contractId: string) {
  return {
    contractId,
    wasmHash: "abc",
    deployedAt: "2026-05-11T12:00:00.000Z",
    sourcePath: "./contracts/x",
    wasmPath: "./rel/x.wasm",
    dependencies: [],
    resolvedDeployArgs: {},
  };
}

async function writeDeployed(tmpDir: string, contracts: Record<string, string>): Promise<void> {
  const artifacts = createInitialArtifacts("app");
  artifacts.networks.testnet = {
    contracts: Object.fromEntries(
      Object.entries(contracts).map(([name, id]) => [name, deployedArtifact(id)])
    ),
    dependencyGraph: {},
  };
  await writeArtifacts(artifacts, tmpDir);
}

async function writeSdkLikeBindingOutput(outputDir: string): Promise<void> {
  await mkdir(path.join(outputDir, "src"), { recursive: true });
  await writeFile(path.join(outputDir, "src", "index.ts"), "export class Client {}\n", "utf8");
  await writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(
      {
        name: "counter",
        version: "0.0.1",
        type: "module",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        exports: { ".": "./dist/index.js" },
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

describe("generateBindingsGraph", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "npx" && args.includes("generate")) {
        const outputDirIndex = args.indexOf("--output-dir");
        const outputDir = outputDirIndex >= 0 ? args[outputDirIndex + 1] : undefined;
        if (outputDir) {
          await writeSdkLikeBindingOutput(outputDir);
        }
      }
      return {
        stdout: "generated",
        stderr: "",
        all: "generated",
      };
    });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("generates bindings for every deployed contract when no contract name is given", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gengraph-"));
    await writeDeployed(tmpDir, { counter: CONTRACT_ID, token: TOKEN_ID });

    const result = await generateBindingsGraph({
      config: baseConfig,
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.network.name).toBe("testnet");
    const names = result.results.map((entry) => entry.contractName).sort();
    expect(names).toEqual(["counter", "token"]);
  });

  it("generates only the named contract when a contract name is given", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gengraph-one-"));
    await writeDeployed(tmpDir, { counter: CONTRACT_ID, token: TOKEN_ID });

    const result = await generateBindingsGraph({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.results.map((entry) => entry.contractName)).toEqual(["counter"]);
  });

  it("generates only the listed contracts when contractNames is given", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gengraph-list-"));
    await writeDeployed(tmpDir, { counter: CONTRACT_ID, token: TOKEN_ID });

    const result = await generateBindingsGraph({
      config: baseConfig,
      contractNames: ["token"],
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.results.map((entry) => entry.contractName)).toEqual(["token"]);
  });

  it("prefers contractName over contractNames when both are given", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gengraph-prec-"));
    await writeDeployed(tmpDir, { counter: CONTRACT_ID, token: TOKEN_ID });

    const result = await generateBindingsGraph({
      config: baseConfig,
      contractName: "counter",
      contractNames: ["token"],
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.results.map((entry) => entry.contractName)).toEqual(["counter"]);
  });

  it("throws ARTIFACT_NOT_FOUND when no contracts are deployed and no name is given", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gengraph-none-"));
    await writeDeployed(tmpDir, {});

    await expect(
      generateBindingsGraph({ config: baseConfig, networkName: "testnet", cwd: tmpDir })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.ARTIFACT_NOT_FOUND });
  });
});
