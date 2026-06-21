import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
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

import { deployContract } from "./deploy-contract.js";

const CONTRACT_ID = `C${"1".repeat(55)}`;

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

const multiContractConfig: CaatingaConfig = {
  ...baseConfig,
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./rel/token.wasm",
      dependsOn: [],
      deployArgs: {},
    },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./rel/marketplace.wasm",
      dependsOn: ["token"],
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}",
      },
    },
  },
};

describe("deployContract", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "deploy") {
        return {
          stdout: `deployed ${CONTRACT_ID}\n`,
          stderr: "",
          all: `deployed ${CONTRACT_ID}\n`,
        };
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_update_artifacts_with_contract_id_when_stellar_succeeds", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");

    const artifacts = createInitialArtifacts("app");
    await writeArtifacts(artifacts, tmpDir);

    const result = await deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.contractId).toBe(CONTRACT_ID);

    const saved = JSON.parse(await readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8"));
    expect(saved.networks.testnet.contracts.counter.contractId).toBe(CONTRACT_ID);
    expect(saved.networks.testnet.contracts.counter.wasmHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should_persist_dependency_metadata_and_resolved_deploy_args", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-deps-"));
    const tokenWasmPath = path.join(tmpDir, "rel", "token.wasm");
    const marketplaceWasmPath = path.join(tmpDir, "rel", "marketplace.wasm");
    await mkdir(path.dirname(tokenWasmPath), { recursive: true });
    await writeFile(tokenWasmPath, Buffer.from("token-wasm-bytes"), "utf8");
    await writeFile(marketplaceWasmPath, Buffer.from("marketplace-wasm-bytes"), "utf8");

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        token: {
          contractId: "C".padEnd(56, "T"),
          wasmHash: "a".repeat(64),
          deployedAt: "2026-05-12T00:00:00.000Z",
          sourcePath: "./contracts/token",
          wasmPath: "./rel/token.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: { token: [], marketplace: ["token"] },
    };
    await writeArtifacts(artifacts, tmpDir);

    await deployContract({
      config: multiContractConfig,
      contractName: "marketplace",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
      resolvedDeployArgs: { tokenContractId: "CTOKENCONTRACTID" },
      dependencies: ["token"],
    });

    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      expect.arrayContaining([
        "contract",
        "deploy",
        "--",
        "--token_contract_id",
        "CTOKENCONTRACTID",
      ]),
      expect.any(Object)
    );

    const saved = JSON.parse(await readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8"));
    expect(saved.networks.testnet.contracts.marketplace).toMatchObject({
      contractId: CONTRACT_ID,
      sourcePath: "./contracts/marketplace",
      wasmPath: "./rel/marketplace.wasm",
      dependencies: ["token"],
      resolvedDeployArgs: { tokenContractId: "CTOKENCONTRACTID" },
    });
    expect(saved.networks.testnet.contracts.marketplace.wasmHash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.networks.testnet.contracts.marketplace.deployedAt).toEqual(expect.any(String));
    expect(saved.networks.testnet.dependencyGraph.marketplace).toEqual(["token"]);
  });

  it("should_parse_contract_id_from_stdout_when_combined_output_is_empty", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "deploy") {
        return { stdout: `deployed ${CONTRACT_ID}\n`, stderr: "", all: "" };
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    const result = await deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.contractId).toBe(CONTRACT_ID);
  });

  it("should_recover_contract_id_when_stellar_deploy_signing_fails_after_submit", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "deploy") {
        throw new CaatingaError(
          "Command failed: stellar contract deploy",
          CaatingaErrorCode.DEPLOY_FAILED,
          [
            "Transaction hash is 9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6",
            "error: xdr processing error: xdr value invalid",
          ].join("\n")
        );
      }

      if (command === "stellar" && args[0] === "contract" && args[1] === "id") {
        return {
          stdout: `${CONTRACT_ID}\n`,
          stderr: "",
          all: `${CONTRACT_ID}\n`,
        };
      }

      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              transaction_successful: true,
              type: "invoke_host_function",
              function: "HostFunctionTypeHostFunctionTypeCreateContract",
              salt: "36760584017419743124423536061373365464991553746983011352231996661702535035363",
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchImpl);

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-recover-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    const result = await deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.contractId).toBe(CONTRACT_ID);
    expect(fetchImpl).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("should_retry_transient_deploy_failures_until_success", async () => {
    let deployAttempts = 0;
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "deploy") {
        deployAttempts += 1;
        if (deployAttempts === 1) {
          throw new CaatingaError(
            "Command failed: stellar contract deploy",
            CaatingaErrorCode.DEPLOY_FAILED,
            "transaction submission timeout"
          );
        }
        return {
          stdout: `deployed ${CONTRACT_ID}\n`,
          stderr: "",
          all: `deployed ${CONTRACT_ID}\n`,
        };
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-retry-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    const deployPromise = deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
      deployRetryDelaysMs: [0],
    });

    const result = await deployPromise;

    expect(result.contractId).toBe(CONTRACT_ID);
    expect(deployAttempts).toBe(2);
  });

  it("should_not_retry_non_transient_deploy_failures", async () => {
    let deployAttempts = 0;
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "deploy") {
        deployAttempts += 1;
        throw new CaatingaError(
          "Command failed: stellar contract deploy",
          CaatingaErrorCode.DEPLOY_FAILED,
          "simulation failed: contract trap"
        );
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-no-retry-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    await expect(
      deployContract({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.DEPLOY_FAILED });

    expect(deployAttempts).toBe(1);
  });

  it("should_map_stellar_deploy_command_failures_to_DEPLOY_FAILED", async () => {
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "deploy") {
        throw new CaatingaError(
          "Command failed: stellar contract deploy",
          CaatingaErrorCode.DEPLOY_FAILED,
          "stellar stderr here"
        );
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    await expect(
      deployContract({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.DEPLOY_FAILED });
  });

  it("should_skip_stellar_contract_deploy_when_artifact_has_contractId_and_force_is_false", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-skip-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");

    const artifacts = createInitialArtifacts("app");
    artifacts.networks.testnet = {
      contracts: {
        counter: {
          contractId: CONTRACT_ID,
          wasmHash: "a".repeat(64),
          deployedAt: "2026-05-12T00:00:00.000Z",
          sourcePath: "./contracts/counter",
          wasmPath: "./rel/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: { counter: [] },
    };
    await writeArtifacts(artifacts, tmpDir);

    const result = await deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
      force: false,
    });

    expect(result.skipped).toBe(true);
    expect(result.contractId).toBe(CONTRACT_ID);
    expect(runCommand).not.toHaveBeenCalledWith(
      "stellar",
      expect.arrayContaining(["contract", "deploy"])
    );
  });

  it("should_return_stale_wasm_warning_when_sources_are_newer_than_wasm", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-stale-"));
    const contractDir = path.join(tmpDir, "contracts", "counter");
    const srcDir = path.join(contractDir, "src");
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(srcDir, { recursive: true });
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeFile(path.join(srcDir, "lib.rs"), "pub fn increment() {}", "utf8");

    const wasmMtime = new Date("2020-01-01T00:00:00.000Z");
    const sourceMtime = new Date("2026-05-18T00:00:00.000Z");
    await utimes(wasmPath, wasmMtime, wasmMtime);
    await utimes(path.join(srcDir, "lib.rs"), sourceMtime, sourceMtime);
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    const result = await deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
    });

    expect(result.staleWasmWarning).toMatch(/may be stale/i);
    expect(result.contractId).toBe(CONTRACT_ID);
    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      expect.arrayContaining(["contract", "deploy"]),
      expect.any(Object)
    );
  });

  it("should_not_return_stale_wasm_warning_when_checkStaleWasm_is_false", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-no-stale-"));
    const contractDir = path.join(tmpDir, "contracts", "counter");
    const srcDir = path.join(contractDir, "src");
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(srcDir, { recursive: true });
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeFile(path.join(srcDir, "lib.rs"), "pub fn increment() {}", "utf8");

    const wasmMtime = new Date("2020-01-01T00:00:00.000Z");
    const sourceMtime = new Date("2026-05-18T00:00:00.000Z");
    await utimes(wasmPath, wasmMtime, wasmMtime);
    await utimes(path.join(srcDir, "lib.rs"), sourceMtime, sourceMtime);
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    const result = await deployContract({
      config: baseConfig,
      contractName: "counter",
      networkName: "testnet",
      source: "alice",
      cwd: tmpDir,
      checkStaleWasm: false,
    });

    expect(result.staleWasmWarning).toBeUndefined();
    expect(result.contractId).toBe(CONTRACT_ID);
  });

  it("should_throw_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED_when_resolved_args_still_contain_placeholders", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deploy-"));
    const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from("wasm-bytes"), "utf8");
    await writeArtifacts(createInitialArtifacts("app"), tmpDir);

    await expect(
      deployContract({
        config: baseConfig,
        contractName: "counter",
        networkName: "testnet",
        source: "alice",
        cwd: tmpDir,
        resolvedDeployArgs: { initArg: "${contracts.x}" },
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_UNRESOLVED,
    });
  });
});
