import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunCommandResult } from "../shell/run-command.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { CaatingaConfigSchema } from "../config/config.schema.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";
import { IMPORTED_SOURCE_MARKER, adoptProject } from "./adopt-project.js";

const CONTRACT_ID = `C${"A".repeat(55)}`;
const OTHER_CONTRACT_ID = `C${"B".repeat(55)}`;
const FAKE_WASM = "fake on-chain wasm bytes";
const FAKE_WASM_HASH = createHash("sha256").update(FAKE_WASM).digest("hex");

const ROOT_MANIFEST = `[workspace]\nmembers = ["contracts/counter"]\n`;
const CONTRACT_MANIFEST = `[package]\nname = "counter"\nversion = "0.1.0"\n\n[lib]\ncrate-type = ["cdylib"]\n`;

const EXISTING_CONFIG = `export default {
  project: "existing-app",
  defaultNetwork: "testnet",
  contracts: {
    existing: {
      path: "./contracts/existing",
      wasm: "./contracts/existing/target/wasm32v1-none/release/existing.wasm"
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  }
};
`;

/**
 * Test seam for the Stellar CLI shell layer: pretends `stellar contract fetch
 * --out-file` succeeded by writing the fake wasm bytes to the requested file.
 */
const fetchContract = vi.fn(
  async (_command: string, args: string[]): Promise<RunCommandResult> => {
    const outFile = args[args.indexOf("--out-file") + 1];
    await writeFile(outFile, FAKE_WASM, "utf8");
    return { stdout: "", stderr: "", all: "" };
  }
);

async function makeWorkspace(): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-"));
  await writeFile(path.join(tmpDir, "Cargo.toml"), ROOT_MANIFEST, "utf8");
  await mkdir(path.join(tmpDir, "contracts/counter"), { recursive: true });
  await writeFile(
    path.join(tmpDir, "contracts/counter/Cargo.toml"),
    CONTRACT_MANIFEST,
    "utf8"
  );
  return tmpDir;
}

/**
 * Seam for the second adopt run in a test: after the first run wrote the real
 * generated config (which imports `@caatinga/core`), loading it from a bare
 * tmp directory would fail module resolution — stand in for a user repo whose
 * dependencies are installed.
 */
const loadInstalledConfig = vi.fn(async () =>
  CaatingaConfigSchema.parse({
    project: "adopted-app",
    defaultNetwork: "testnet",
    contracts: {
      counter: {
        path: "./contracts/counter",
        wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
      },
    },
    networks: {
      testnet: {
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      },
    },
  })
);

describe("adoptProject", () => {
  let tmpDir: string;

  beforeEach(() => {
    fetchContract.mockReset();
    loadInstalledConfig.mockReset();
    // Re-install the default successful fetch impl after a reset.
    fetchContract.mockImplementation(async (_command: string, args: string[]) => {
      const outFile = args[args.indexOf("--out-file") + 1];
      await writeFile(outFile, FAKE_WASM, "utf8");
      return { stdout: "", stderr: "", all: "" };
    });
    loadInstalledConfig.mockImplementation(async () =>
      CaatingaConfigSchema.parse({
        project: "adopted-app",
        defaultNetwork: "testnet",
        contracts: {
          counter: {
            path: "./contracts/counter",
            wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
          },
        },
        networks: {
          testnet: {
            rpcUrl: "https://soroban-testnet.stellar.org",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
        },
      })
    );
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("writes config and v2 artifacts for a discovered workspace", async () => {
    tmpDir = await makeWorkspace();

    const result = await adoptProject({
      cwd: tmpDir,
      projectName: "adopted-app",
      runCommandFn: fetchContract,
    });

    expect(result.configWritten).toBe(true);
    expect(result.projectName).toBe("adopted-app");
    expect(result.network).toBe("testnet");
    expect(result.discoveredContracts.map((c) => c.name)).toEqual(["counter"]);

    const config = await readFile(path.join(tmpDir, "caatinga.config.ts"), "utf8");
    expect(config).toContain('"counter"');
    expect(config).toContain("contracts/counter/target/wasm32v1-none/release/counter.wasm");

    const artifacts = await readArtifacts(tmpDir);
    expect(artifacts.version).toBe(2);
    expect(artifacts.project).toBe("adopted-app");
    expect(artifacts.networks.testnet?.contracts).toEqual({});
  });

  it("imports a deployed contract by re-deriving the wasmHash on-chain", async () => {
    tmpDir = await makeWorkspace();

    const result = await adoptProject({
      cwd: tmpDir,
      imports: [{ contractId: CONTRACT_ID }],
      runCommandFn: fetchContract,
    });

    // Single contract crate: its name is the default entry name.
    expect(result.importedContracts).toEqual(["counter"]);

    const args = fetchContract.mock.calls[0][1];
    expect(args.slice(0, 5)).toEqual(["contract", "fetch", "--id", CONTRACT_ID, "--out-file"]);
    expect(args).toContain("--network");
    expect(args).toContain("testnet");

    const artifacts = await readArtifacts(tmpDir);
    const entry = artifacts.networks.testnet?.contracts.counter;
    expect(entry).toMatchObject({
      contractId: CONTRACT_ID,
      wasmHash: FAKE_WASM_HASH,
      sourcePath: IMPORTED_SOURCE_MARKER,
      dependencies: [],
    });
  });

  it("is idempotent: a second run skips the already-imported contract", async () => {
    tmpDir = await makeWorkspace();

    await adoptProject({
      cwd: tmpDir,
      imports: [{ contractId: CONTRACT_ID }],
      runCommandFn: fetchContract,
    });
    expect(fetchContract).toHaveBeenCalledTimes(1);

    const result = await adoptProject({
      cwd: tmpDir,
      imports: [{ contractId: CONTRACT_ID }],
      loadConfigFn: loadInstalledConfig,
      runCommandFn: fetchContract,
    });

    expect(result.skippedContracts).toEqual(["counter"]);
    expect(result.importedContracts).toEqual([]);
    expect(fetchContract).toHaveBeenCalledTimes(1);

    const artifacts = await readArtifacts(tmpDir);
    expect(artifacts.networks.testnet?.contracts.counter).toMatchObject({
      contractId: CONTRACT_ID,
      wasmHash: FAKE_WASM_HASH,
    });
  });

  it("merges into existing artifacts without overwriting existing entries", async () => {
    tmpDir = await makeWorkspace();
    await writeArtifacts(
      {
        project: "preexisting",
        version: 2,
        networks: {
          testnet: {
            contracts: {
              keeper: {
                contractId: OTHER_CONTRACT_ID,
                wasmHash: FAKE_WASM_HASH,
                deployedAt: "2026-01-01T00:00:00.000Z",
                sourcePath: "original deploy",
                wasmPath: "original.wasm",
                dependencies: [],
                resolvedDeployArgs: {},
              },
            },
            dependencyGraph: {},
          },
        },
      },
      tmpDir
    );

    const result = await adoptProject({
      cwd: tmpDir,
      imports: [{ contractId: CONTRACT_ID, name: "counter" }],
      runCommandFn: fetchContract,
    });

    expect(result.artifactsAlreadyExisted).toBe(true);
    expect(result.importedContracts).toEqual(["counter"]);

    const artifacts = await readArtifacts(tmpDir);
    expect(artifacts.project).toBe("preexisting");
    expect(artifacts.networks.testnet?.contracts.keeper).toMatchObject({
      contractId: OTHER_CONTRACT_ID,
      sourcePath: "original deploy",
    });
    expect(artifacts.networks.testnet?.contracts.counter).toMatchObject({
      contractId: CONTRACT_ID,
    });
  });

  it("replaces only the --force-named entry", async () => {
    tmpDir = await makeWorkspace();
    await adoptProject({
      cwd: tmpDir,
      imports: [{ contractId: CONTRACT_ID }],
      runCommandFn: fetchContract,
    });
    fetchContract.mockClear();

    const result = await adoptProject({
      cwd: tmpDir,
      imports: [{ contractId: OTHER_CONTRACT_ID }],
      force: true,
      loadConfigFn: loadInstalledConfig,
      runCommandFn: fetchContract,
    });

    expect(result.replacedContracts).toEqual(["counter"]);
    expect(fetchContract).toHaveBeenCalledTimes(1);

    const artifacts = await readArtifacts(tmpDir);
    expect(artifacts.networks.testnet?.contracts.counter).toMatchObject({
      contractId: OTHER_CONTRACT_ID,
    });
  });

  it("rejects malformed contract IDs before touching the filesystem", async () => {
    tmpDir = await makeWorkspace();

    await expect(
      adoptProject({
        cwd: tmpDir,
        imports: [{ contractId: "not-a-strkey" }],
        runCommandFn: fetchContract,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.INVALID_CONFIG });

    expect(fetchContract).not.toHaveBeenCalled();
    // No half-adopted state: neither config nor artifacts were left behind.
    await expect(readFile(path.join(tmpDir, "caatinga.config.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8")
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports the fetch failure when the contract is not deployed on the network", async () => {
    tmpDir = await makeWorkspace();
    fetchContract.mockRejectedValue(
      new CaatingaError(
        "Command failed: stellar contract fetch",
        CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        "contract not found"
      )
    );

    await expect(
      adoptProject({
        cwd: tmpDir,
        imports: [{ contractId: CONTRACT_ID, name: "counter" }],
        runCommandFn: fetchContract,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
      message: expect.stringContaining('not deployed on "testnet"'),
    });
  });

  it("resolves the network from an existing config and leaves the config untouched", async () => {
    tmpDir = await makeWorkspace();
    await writeFile(path.join(tmpDir, "caatinga.config.ts"), EXISTING_CONFIG, "utf8");

    const result = await adoptProject({
      cwd: tmpDir,
      runCommandFn: fetchContract,
    });

    expect(result.configWritten).toBe(false);
    expect(result.configAlreadyExisted).toBe(true);
    expect(result.network).toBe("testnet");

    const config = await readFile(path.join(tmpDir, "caatinga.config.ts"), "utf8");
    expect(config).toContain('project: "existing-app"');
  });

  it("fails for a non-well-known network without a config", async () => {
    tmpDir = await makeWorkspace();

    await expect(
      adoptProject({
        cwd: tmpDir,
        networkName: "custom-net",
        runCommandFn: fetchContract,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.INVALID_CONFIG });
  });
});
