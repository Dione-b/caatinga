import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

import { upgradeContractInPlace } from "./upgrade-contract.js";

const CONTRACT_ID = `C${"2".repeat(55)}`;
const OLD_WASM = Buffer.from("old-wasm");
const NEW_WASM = Buffer.from("new-wasm");
const OLD_HASH = createHash("sha256").update(OLD_WASM).digest("hex");
const NEW_HASH = createHash("sha256").update(NEW_WASM).digest("hex");

const baseConfig: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    sticker: {
      path: "./contracts/sticker",
      wasm: "./rel/sticker.wasm",
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

describe("upgradeContractInPlace", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === "stellar" && args[0] === "contract" && args[1] === "build") {
        return { stdout: "built", stderr: "", all: "built" };
      }
      if (command === "stellar" && args[0] === "contract" && args[1] === "upload") {
        return {
          stdout: `${NEW_HASH}\n`,
          stderr: "",
          all: `${NEW_HASH}\n`,
        };
      }
      if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
        return { stdout: "[]", stderr: "", all: "[]" };
      }
      return { stdout: "0.0.0", stderr: "", all: "0.0.0" };
    });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function seedProject(wasmBytes: Buffer, wasmHash: string) {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-upgrade-"));
    const wasmPath = path.join(tmpDir, "rel", "sticker.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, wasmBytes);

    const artifacts = createInitialArtifacts("app", { networks: ["testnet"] });
    artifacts.version = 2;
    artifacts.networks.testnet = {
      contracts: {
        sticker: {
          contractId: CONTRACT_ID,
          wasmHash,
          deployedAt: "2026-05-11T00:00:00.000Z",
          sourcePath: "./contracts/sticker",
          wasmPath: "./rel/sticker.wasm",
          dependencies: [],
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    };
    await writeArtifacts(artifacts, tmpDir);
  }

  it("should_upload_invoke_and_update_artifact_in_place", async () => {
    await seedProject(NEW_WASM, OLD_HASH);

    const result = await upgradeContractInPlace({
      config: baseConfig,
      contractName: "sticker",
      networkName: "testnet",
      source: "deployer",
      cwd: tmpDir,
    });

    expect(result.skipped).toBe(false);
    expect(result.contractId).toBe(CONTRACT_ID);
    expect(result.wasmHash).toBe(NEW_HASH);

    const saved = JSON.parse(await readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8"));
    expect(saved.networks.testnet.contracts.sticker.contractId).toBe(CONTRACT_ID);
    expect(saved.networks.testnet.contracts.sticker.wasmHash).toBe(NEW_HASH);
    expect(saved.networks.testnet.contracts.sticker.upgradeStrategy).toBe("in-place");
    expect(saved.networks.testnet.contracts.sticker.history[0]).toMatchObject({
      contractId: CONTRACT_ID,
      wasmHash: OLD_HASH,
      upgradeType: "in-place",
      reason: "upgrade",
    });

    const invokeCall = runCommand.mock.calls.find(
      ([, args]) => args[0] === "contract" && args[1] === "invoke"
    );
    expect(invokeCall?.[1]).toContain("--new_wasm_hash");
    expect(invokeCall?.[1]).toContain(NEW_HASH);
  });

  it("should_skip_when_if_changed_and_hash_matches", async () => {
    await seedProject(NEW_WASM, NEW_HASH);

    const result = await upgradeContractInPlace({
      config: baseConfig,
      contractName: "sticker",
      networkName: "testnet",
      source: "deployer",
      cwd: tmpDir,
      ifChanged: true,
      build: false,
    });

    expect(result.skipped).toBe(true);
    // #85: the skip path must return the artifacts file path, not cwd.
    expect(result.artifactPath).toBe(path.join(tmpDir, "caatinga.artifacts.json"));
    const uploadCalls = runCommand.mock.calls.filter(([, args]) => args[1] === "upload");
    const invokeCalls = runCommand.mock.calls.filter(([, args]) => args[1] === "invoke");
    expect(uploadCalls).toHaveLength(0);
    expect(invokeCalls).toHaveLength(0);
  });

  it("should_fail_when_artifact_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-upgrade-"));
    const artifacts = createInitialArtifacts("app", { networks: ["testnet"] });
    await writeArtifacts(artifacts, tmpDir);

    await expect(
      upgradeContractInPlace({
        config: baseConfig,
        contractName: "sticker",
        networkName: "testnet",
        source: "deployer",
        cwd: tmpDir,
        build: false,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.ARTIFACT_NOT_FOUND });
  });
});
