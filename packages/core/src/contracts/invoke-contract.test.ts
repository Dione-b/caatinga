import { mkdtemp, rm } from "node:fs/promises";
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

import { invokeContract, parseInvokeTarget } from "./invoke-contract.js";

const CONTRACT_ID = `C${"3".repeat(55)}`;

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
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./out" },
};

describe("parseInvokeTarget", () => {
  it("parses contract.method targets", () => {
    expect(parseInvokeTarget("counter.increment")).toEqual({
      contractName: "counter",
      method: "increment",
    });
  });

  it("rejects invalid target shapes", () => {
    expect(() => parseInvokeTarget("counter")).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.INVOKE_TARGET_INVALID })
    );
    expect(() => parseInvokeTarget("counter.increment.extra")).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.INVOKE_TARGET_INVALID })
    );
  });
});

describe("invokeContract", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: "42\n", stderr: "", all: "42\n" };
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_forward_method_and_args_to_stellar_when_artifact_exists", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-invoke-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "abc",
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/counter",
          wasmPath: "./rel/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    const result = await invokeContract({
      config: baseConfig,
      target: "counter.increment",
      args: ["--arg1", "x"],
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.result).toContain("42");
    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      expect.arrayContaining([
        "contract",
        "invoke",
        "--id",
        CONTRACT_ID,
        "--source-account",
        "alice",
        "--network",
        "testnet",
        "--",
        "increment",
        "--arg1",
        "x",
      ]),
      { cwd: tmpDir, failureCode: CaatingaErrorCode.INVOKE_FAILED }
    );
  });

  it("should_map_stellar_invoke_failure_to_INVOKE_FAILED", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-invoke-fail-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "abc",
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/counter",
          wasmPath: "./rel/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        throw new CaatingaError(
          "Command failed: stellar contract invoke",
          CaatingaErrorCode.INVOKE_FAILED,
          "stellar stderr here"
        );
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    await expect(
      invokeContract({
        config: baseConfig,
        target: "counter.increment",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.INVOKE_FAILED });
  });

  it("should_surface_actionable_hint_when_stellar_invoke_signing_fails", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-invoke-xdr-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "abc",
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/counter",
          wasmPath: "./rel/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        throw new CaatingaError(
          "Command failed: stellar contract invoke",
          CaatingaErrorCode.INVOKE_FAILED,
          "error: xdr processing error: xdr value invalid"
        );
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    await expect(
      invokeContract({
        config: baseConfig,
        target: "counter.increment",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.INVOKE_FAILED,
      hint: expect.stringContaining("Stellar CLI 22.x"),
    });
  });

  it("should_surface_read_call_hint_when_stellar_reports_read_only_method", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-invoke-read-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "abc",
          deployedAt: "2026-05-11T12:00:00.000Z",
          sourcePath: "./contracts/counter",
          wasmPath: "./rel/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);

    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        throw new CaatingaError(
          "Command failed: stellar contract invoke",
          CaatingaErrorCode.INVOKE_FAILED,
          "This is a read call. Use force: true to sign and send anyway."
        );
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    await expect(
      invokeContract({
        config: baseConfig,
        target: "counter.get",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.INVOKE_FAILED,
      hint: expect.stringMatching(/caatinga read counter\.get/),
    });
  });
});
