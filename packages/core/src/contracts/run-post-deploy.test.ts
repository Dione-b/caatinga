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

const CONTRACT_ID = `C${"5".repeat(55)}`;

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
  postDeploy: [{ contract: "coin", method: "set_minter", args: {}, kind: "invoke" }],
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

    expect(result).toEqual([
      { contract: "coin", method: "set_minter", result: "ok", kind: "invoke" },
    ]);
    expect(invokeCalls()).toHaveLength(2);
    expect(retries).toEqual([{ attempt: 1, maxAttempts: 2, delayMs: 0 }]);
  });

  it("should_use_hook_source_override_when_provided", async () => {
    const configWithSourceOverride: CaatingaConfig = {
      ...config,
      postDeploy: [
        { contract: "coin", method: "set_minter", args: {}, source: "issuer", kind: "invoke" },
      ],
    };

    const result = await runPostDeployHooks({
      config: configWithSourceOverride,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    });

    expect(result).toEqual([
      { contract: "coin", method: "set_minter", result: undefined, kind: "invoke" },
    ]);

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

    expect(result).toEqual([
      { contract: "coin", method: "set_minter", result: undefined, kind: "invoke" },
    ]);

    const calls = invokeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toContain("--source-account");
    expect(calls[0][1]).toContain("alice");
  });

  it("should_throw_when_hook_source_is_a_secret_key", async () => {
    const configWithBadSource: CaatingaConfig = {
      ...config,
      postDeploy: [
        {
          contract: "coin",
          method: "set_minter",
          args: {},
          source: "SABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890EFG123",
          kind: "invoke",
        },
      ],
    };

    await expect(
      runPostDeployHooks({
        config: configWithBadSource,
        source: "alice",
        cwd: tmpDir,
        hookRetryDelaysMs: [0],
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.SOURCE_IS_SECRET_KEY });
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

  it("should_pass_when_expect_matches_invoke_output", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: "CADMINADDRESS123", stderr: "", all: "CADMINADDRESS123" };
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    const configWithExpect: CaatingaConfig = {
      ...config,
      postDeploy: [
        {
          contract: "coin",
          method: "get_admin",
          args: {},
          expect: "CADMINADDRESS123",
          kind: "invoke",
        },
      ],
    };

    const result = await runPostDeployHooks({
      config: configWithExpect,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    });

    expect(result).toEqual([
      { contract: "coin", method: "get_admin", result: "CADMINADDRESS123", kind: "invoke" },
    ]);
  });

  it("should_throw_when_expect_does_not_match_invoke_output", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: "COTHERADDRESS", stderr: "", all: "COTHERADDRESS" };
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    const configWithExpect: CaatingaConfig = {
      ...config,
      postDeploy: [
        {
          contract: "coin",
          method: "get_admin",
          args: {},
          expect: "CADMINADDRESS123",
          kind: "invoke",
        },
      ],
    };

    await expect(
      runPostDeployHooks({
        config: configWithExpect,
        source: "alice",
        cwd: tmpDir,
        hookRetryDelaysMs: [0],
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.POST_DEPLOY_VERIFY_FAILED });
  });

  it("should_resolve_source_address_placeholder_in_expect", async () => {
    const ALICE_ADDRESS = "G" + "A".repeat(20) + "L".repeat(18) + "I".repeat(17);

    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "keys" && args[1] === "address") {
        return { stdout: ALICE_ADDRESS, stderr: "", all: ALICE_ADDRESS };
      }
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: ALICE_ADDRESS, stderr: "", all: ALICE_ADDRESS };
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    const configWithExpect: CaatingaConfig = {
      ...config,
      postDeploy: [
        {
          contract: "coin",
          method: "get_admin",
          args: {},
          expect: "${source.address}",
          kind: "invoke",
        },
      ],
    };

    const result = await runPostDeployHooks({
      config: configWithExpect,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    });

    expect(result).toEqual([
      { contract: "coin", method: "get_admin", result: ALICE_ADDRESS, kind: "invoke" },
    ]);
  });

  it("should_pass_structural_isArray_expect_when_state_is_not_empty", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: '[{"id":1}]', stderr: "", all: '[{"id":1}]' };
      }
      return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
    });

    const configWithExpect: CaatingaConfig = {
      ...config,
      postDeploy: [
        {
          contract: "coin",
          method: "list_items",
          args: {},
          expect: { matcher: "isArray" },
          kind: "invoke",
        },
      ],
    };

    const result = await runPostDeployHooks({
      config: configWithExpect,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    });

    expect(result).toEqual([
      { contract: "coin", method: "list_items", result: '[{"id":1}]', kind: "invoke" },
    ]);
  });
});
