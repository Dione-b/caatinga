import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand
}));

import { buildContract } from "./build-contract.js";

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
  frontend: { framework: "vite-react", bindingsOutput: "./out" }
};

describe("buildContract", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({ stdout: "ok", stderr: "", all: "ok" });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_run_stellar_contract_build_in_contract_source_dir_when_binaries_ok", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
    const sourceDir = path.join(tmpDir, "contracts", "counter");
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(sourceDir, { recursive: true });
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

    await buildContract({
      config: baseConfig,
      contractName: "counter",
      cwd: tmpDir
    });

    expect(runCommand).toHaveBeenCalledWith("stellar", ["contract", "build"], {
      cwd: sourceDir,
      failureCode: CaatingaErrorCode.BUILD_FAILED
    });
  });

  it("should_throw_RUST_TARGET_NOT_FOUND_when_stellar_build_reports_missing_wasm32v1_none", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
    const sourceDir = path.join(tmpDir, "contracts", "counter");
    await mkdir(sourceDir, { recursive: true });

    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "build") {
        throw new CaatingaError(
          "Command failed: stellar contract build",
          CaatingaErrorCode.BUILD_FAILED,
          "the wasm32v1-none target may not be installed",
          new Error("error: the wasm32v1-none target is not installed. run `rustup target add wasm32v1-none`")
        );
      }

      return { stdout: "ok", stderr: "", all: "ok" };
    });

    await expect(
      buildContract({
        config: baseConfig,
        contractName: "counter",
        cwd: tmpDir
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.RUST_TARGET_NOT_FOUND
    });
  });

  it("should_rethrow_BUILD_FAILED_when_stellar_build_failure_is_unrelated_to_missing_target", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
    const sourceDir = path.join(tmpDir, "contracts", "counter");
    await mkdir(sourceDir, { recursive: true });

    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "build") {
        throw new CaatingaError(
          "Command failed: stellar contract build",
          CaatingaErrorCode.BUILD_FAILED,
          "compilation error: missing semicolon",
          new Error("error: expected `;`")
        );
      }

      return { stdout: "ok", stderr: "", all: "ok" };
    });

    await expect(
      buildContract({
        config: baseConfig,
        contractName: "counter",
        cwd: tmpDir
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.BUILD_FAILED
    });
  });

  it("should_resolve_legacy_wasm_target_path_after_stellar_build", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
    const sourceDir = path.join(tmpDir, "contracts", "counter");
    const legacyWasmPath = path.join(
      tmpDir,
      "contracts",
      "counter",
      "target",
      "wasm32-unknown-unknown",
      "release",
      "counter.wasm"
    );
    const currentWasmPath = path.join(
      tmpDir,
      "contracts",
      "counter",
      "target",
      "wasm32v1-none",
      "release",
      "counter.wasm"
    );
    const config: CaatingaConfig = {
      ...baseConfig,
      contracts: {
        counter: {
          ...baseConfig.contracts.counter,
          path: "./contracts/counter",
          wasm: "./contracts/counter/target/wasm32-unknown-unknown/release/counter.wasm"
        }
      }
    };

    await mkdir(sourceDir, { recursive: true });
    await mkdir(path.dirname(currentWasmPath), { recursive: true });
    await writeFile(currentWasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

    const result = await buildContract({
      config,
      contractName: "counter",
      cwd: tmpDir
    });

    expect(result.contract.wasmPath).toBe(currentWasmPath);
    await expect(access(legacyWasmPath)).rejects.toBeDefined();
  });

  it("rethrows UNSUPPORTED_CLI_VERSION surfaced from the preflight version check", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
    const sourceDir = path.join(tmpDir, "contracts", "counter");
    await mkdir(sourceDir, { recursive: true });
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "--version") {
        throw new CaatingaError(
          "Stellar CLI 22.0.1 is below the supported minimum 23.0.0.",
          CaatingaErrorCode.UNSUPPORTED_CLI_VERSION
        );
      }

      return { stdout: "ok", stderr: "", all: "ok" };
    });

    await expect(buildContract({
      config: baseConfig,
      contractName: "counter",
      cwd: tmpDir
    })).rejects.toMatchObject({
      code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION
    });
  });
});
