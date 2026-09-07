import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { frontendBindingsConfigSnippet } from "../frontend/bindings-config-hint.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

vi.mock("../stellar-sdk/check-stellar-sdk-version.js", () => ({
  checkStellarSdkVersion: vi.fn(async () => ({
    version: "16.0.1",
    status: "supported",
    minVersion: "16.0.1",
    lastTestedVersion: "16.0.1",
    warnings: [],
  })),
}));

import { generateBindings } from "./generate-bindings.js";
import { readBindingMarker } from "../bindings/binding-marker.js";

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
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./src/gen" },
};

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

describe("generateBindings", () => {
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
        return { stdout: "generated", stderr: "", all: "generated" };
      }
      return { stdout: "", stderr: "", all: "" };
    });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_call_stellar_bindings_with_contract_id_and_output_dir", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gen-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
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

    const result = await generateBindings({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.outputDir).toBe(path.join(tmpDir, "src/gen/counter"));
    expect(result.importPath).toBe("./src/gen/counter");
    expect(result.legacyStubRemoved).toBe(false);
    expect(result.marker).toMatchObject({
      version: 1,
      contractId: CONTRACT_ID,
      wasmHash: "a".repeat(64),
      network: "testnet",
    });
    await expect(readBindingMarker(result.outputDir)).resolves.toEqual(result.marker);

    const packageJson = JSON.parse(
      await readFile(path.join(result.outputDir, "package.json"), "utf8")
    );
    expect(packageJson.main).toBe("./src/index.ts");
    expect(packageJson.types).toBe("./src/index.ts");
    expect(packageJson.exports["."]).toBe("./src/index.ts");

    expect(runCommand).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining([
        "--yes",
        "@stellar/stellar-sdk",
        "generate",
        "--contract-id",
        CONTRACT_ID,
        "--output-dir",
        result.outputDir,
        "--contract-name",
        "counter",
        "--overwrite",
        "--network",
        "testnet",
      ]),
      { cwd: tmpDir, failureCode: CaatingaErrorCode.BINDINGS_FAILED }
    );
  });

  it("should_remove_legacy_flat_stub_and_return_importPath_when_stub_exists", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gen-legacy-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
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

    const legacyStubPath = path.join(tmpDir, "src/gen/counter.ts");
    await mkdir(path.dirname(legacyStubPath), { recursive: true });
    await writeFile(legacyStubPath, "export class Client {}\n", "utf8");

    const result = await generateBindings({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      cwd: tmpDir,
    });

    expect(result.importPath).toBe("./src/gen/counter");
    expect(result.legacyStubRemoved).toBe(true);
    await expect(access(legacyStubPath)).rejects.toBeDefined();
  });

  it("should_throw_CAATINGA_ARTIFACT_NOT_FOUND_when_not_deployed", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gen-"));
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    await expect(
      generateBindings({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.ARTIFACT_NOT_FOUND });
  });

  it("should_throw_CAATINGA_INVALID_CONFIG_when_frontend_is_not_configured", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gen-no-frontend-"));
    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
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
    const { frontend: _frontend, ...zkOnlyConfig } = baseConfig;

    await expect(
      generateBindings({
        config: zkOnlyConfig,
        contractName: "counter",
        networkName: "testnet",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_CONFIG,
      message: "Frontend bindings are not configured.",
      // Naming the field was not enough (#104) — the hint must show the shape to paste.
      hint: expect.stringContaining(frontendBindingsConfigSnippet()),
    });
  });

  it("should_propagate_BINDINGS_FAILED_when_stellar_bindings_command_fails", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gen-fail-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
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
      if (command === "npx" && args.includes("generate")) {
        throw new CaatingaError(
          "Command failed: npx @stellar/stellar-sdk generate",
          CaatingaErrorCode.BINDINGS_FAILED,
          "bindings output"
        );
      }
      return { stdout: "", stderr: "", all: "" };
    });

    await expect(
      generateBindings({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.BINDINGS_FAILED });

    await expect(readBindingMarker(path.join(tmpDir, "src/gen/counter"))).resolves.toBeNull();
  });

  it("should_propagate_CaatingaError_from_runCommand_unchanged", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-gen-build-"));

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
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
      if (command === "npx" && args.includes("generate")) {
        throw new CaatingaError("cargo failed", CaatingaErrorCode.BUILD_FAILED, "rustc output");
      }
      return { stdout: "", stderr: "", all: "" };
    });

    await expect(
      generateBindings({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.BUILD_FAILED });
  });
});
