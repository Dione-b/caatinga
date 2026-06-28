import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import { buildWorkspace } from "./build-workspace.js";

describe("buildWorkspace", () => {
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

  it("should_warn_when_buildRoot_and_buildFeatures_coexist", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-ws-"));
    const wasmPath = path.join(tmpDir, "target", "wasm32v1-none", "release", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config: CaatingaConfig = {
      project: "app",
      defaultNetwork: "testnet",
      buildRoot: ".",
      contracts: {
        counter: {
          path: "./contracts/counter",
          wasm: "./target/wasm32v1-none/release/counter.wasm",
          dependsOn: [],
          deployArgs: {},
          buildFeatures: ["--no-default-features", "--features", "testnet"],
        },
      },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
    };

    await buildWorkspace({ config, cwd: tmpDir });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("buildFeatures"));
    warnSpy.mockRestore();
  });

  it("should_not_warn_when_buildFeatures_is_absent", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-ws-"));
    const wasmPath = path.join(tmpDir, "target", "wasm32v1-none", "release", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config: CaatingaConfig = {
      project: "app",
      defaultNetwork: "testnet",
      buildRoot: ".",
      contracts: {
        counter: {
          path: "./contracts/counter",
          wasm: "./target/wasm32v1-none/release/counter.wasm",
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

    await buildWorkspace({ config, cwd: tmpDir });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
