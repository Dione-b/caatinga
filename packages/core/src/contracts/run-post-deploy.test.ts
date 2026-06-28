import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { updateArtifact } from "../artifacts/update-artifact.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import { runPostDeployHooks } from "./run-post-deploy.js";

const CONTRACT_ID = `C${"1".repeat(55)}`;

const config: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    coin: {
      path: "./contracts/coin",
      wasm: "./rel/coin.wasm",
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
  postDeploy: [{ contract: "coin", method: "set_minter", args: {} }],
};

function invokeCalls() {
  return runCommand.mock.calls.filter(
    ([command, args]) => command === "stellar" && args[0] === "contract" && args[1] === "invoke"
  );
}

describe("runPostDeployHooks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    runCommand.mockReset();
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: "", stderr: "", all: "" };
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wire-"));
    await mkdir(path.join(tmpDir, "rel"), { recursive: true });

    const artifacts = updateArtifact(
      createInitialArtifacts("app", { networks: ["testnet"] }),
      "testnet",
      "coin",
      {
        contractId: CONTRACT_ID,
        wasmHash: "abc123",
        deployedAt: new Date().toISOString(),
        sourcePath: "./contracts/coin",
        wasmPath: "./rel/coin.wasm",
        dependencies: [],
        resolvedDeployArgs: {},
      }
    );
    await writeArtifacts(artifacts, tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should_retry_hook_when_stellar_reports_bad_sequence", async () => {
    let attempts = 0;
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        attempts += 1;
        if (attempts === 1) {
          throw new CaatingaError(
            "Command failed: stellar contract invoke",
            CaatingaErrorCode.INVOKE_FAILED,
            "transaction failed: TxBadSeq"
          );
        }
        return { stdout: "ok", stderr: "", all: "ok" };
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    const retries: Array<{ attempt: number; maxAttempts: number; delayMs: number }> = [];

    const result = await runPostDeployHooks({
      config,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
      onTransientHookRetry: ({ attempt, maxAttempts, delayMs }) => {
        retries.push({ attempt, maxAttempts, delayMs });
      },
    });

    expect(result).toEqual([{ contract: "coin", method: "set_minter", result: "ok" }]);
    expect(invokeCalls()).toHaveLength(2);
    expect(retries).toEqual([{ attempt: 1, maxAttempts: 2, delayMs: 0 }]);
  });

  it("should_use_hook_source_override_when_provided", async () => {
    const configWithSourceOverride: CaatingaConfig = {
      ...config,
      postDeploy: [
        { contract: "coin", method: "set_minter", args: {}, source: "issuer" },
      ],
    };

    const result = await runPostDeployHooks({
      config: configWithSourceOverride,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    });

    expect(result).toEqual([{ contract: "coin", method: "set_minter", result: undefined }]);

    const calls = invokeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toContain("--source-account");
    expect(calls[0][1]).toContain("issuer");
  });

  it("should_fallback_to_cli_source_when_hook_source_is_omitted", async () => {
    const result = await runPostDeployHooks({
      config,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    });

    expect(result).toEqual([{ contract: "coin", method: "set_minter", result: undefined }]);

    const calls = invokeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toContain("--source-account");
    expect(calls[0][1]).toContain("alice");
  });

  it("should_not_retry_hook_when_failure_is_not_transient", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        throw new CaatingaError(
          "Command failed: stellar contract invoke",
          CaatingaErrorCode.INVOKE_FAILED,
          "simulation failed: contract trap"
        );
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    await expect(
      runPostDeployHooks({
        config,
        source: "alice",
        cwd: tmpDir,
        hookRetryDelaysMs: [0],
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.INVOKE_FAILED });

    expect(invokeCalls()).toHaveLength(1);
  });
});
