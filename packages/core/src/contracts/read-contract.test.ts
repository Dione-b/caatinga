import { mkdtemp, rm } from "node:fs/promises";
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

import { readContract } from "./read-contract.js";

const CONTRACT_ID = `C${"4".repeat(55)}`;

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    app: {
      path: "./contracts/app",
      wasm: "./rel/app.wasm",
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

describe("readContract", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({ stdout: "1\n", stderr: "", all: "1\n" });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_forward_read_invocation_with_send_no", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-read-"));
    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        app: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/app",
          wasmPath: "./rel/app.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    const result = await readContract({
      config: baseConfig,
      target: "app.version",
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.result).toContain("1");
    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      expect.arrayContaining([
        "contract",
        "invoke",
        "--id",
        CONTRACT_ID,
        "--source-account",
        "alice",
        "--send=no",
        "--network",
        "testnet",
        "--",
        "version",
      ]),
      { cwd: tmpDir, failureCode: CaatingaErrorCode.INVOKE_FAILED }
    );
  });

  it("should_use_CAATINGA_SOURCE_when_set", async () => {
    const previous = process.env.CAATINGA_SOURCE;
    process.env.CAATINGA_SOURCE = "bob";
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-read-"));
    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        app: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/app",
          wasmPath: "./rel/app.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    try {
      await readContract({
        config: baseConfig,
        target: "app.version",
        networkName: "testnet",
        cwd: tmpDir,
      });

      expect(runCommand).toHaveBeenCalledWith(
        "stellar",
        expect.arrayContaining(["--source-account", "bob"]),
        expect.any(Object)
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CAATINGA_SOURCE;
      } else {
        process.env.CAATINGA_SOURCE = previous;
      }
    }
  });

  it("should_prefer_explicit_source_over_CAATINGA_SOURCE", async () => {
    const previous = process.env.CAATINGA_SOURCE;
    process.env.CAATINGA_SOURCE = "bob";
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-read-"));
    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        app: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/app",
          wasmPath: "./rel/app.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    try {
      await readContract({
        config: baseConfig,
        target: "app.version",
        networkName: "testnet",
        source: "carol",
        cwd: tmpDir,
      });

      expect(runCommand).toHaveBeenCalledWith(
        "stellar",
        expect.arrayContaining(["--source-account", "carol"]),
        expect.any(Object)
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CAATINGA_SOURCE;
      } else {
        process.env.CAATINGA_SOURCE = previous;
      }
    }
  });
});
