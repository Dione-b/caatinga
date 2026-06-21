import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { CaatingaArtifactsSchema } from "./artifact.schema.js";
import { readArtifacts } from "./read-artifacts.js";
import { createInitialArtifacts, writeArtifacts } from "./write-artifacts.js";

describe("writeArtifacts and readArtifacts", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_roundtrip_valid_artifacts_json", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-art-"));
    const initial = createInitialArtifacts("app");
    initial.networks.testnet = { contracts: {}, dependencyGraph: {} };

    await writeArtifacts(initial, tmpDir);
    const loaded = await readArtifacts(tmpDir);

    expect(loaded.project).toBe("app");
    expect(loaded.version).toBe(2);
    expect(loaded.networks.testnet?.contracts).toEqual({});

    const raw = await readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8");
    expect(JSON.parse(raw).version).toBe(2);
  });

  it("should_create_initial_artifacts_with_network_scaffold", () => {
    const initial = createInitialArtifacts("app", { networks: ["testnet", "mainnet"] });

    expect(initial).toEqual({
      project: "app",
      version: 2,
      networks: {
        testnet: {
          contracts: {},
          dependencyGraph: {},
        },
        mainnet: {
          contracts: {},
          dependencyGraph: {},
        },
      },
    });
  });

  it("should_throw_CAATINGA_ARTIFACT_NOT_FOUND_when_file_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-art-"));
    await expect(readArtifacts(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACT_NOT_FOUND,
    });
  });

  it("should_throw_CAATINGA_ARTIFACT_INVALID_when_json_malformed", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-art-"));
    await writeFile(path.join(tmpDir, "caatinga.artifacts.json"), "{", "utf8");
    await expect(readArtifacts(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACT_INVALID,
    });
  });

  it("accepts dependency metadata in version 1 artifacts", () => {
    const artifacts = CaatingaArtifactsSchema.parse({
      project: "marketplace-app",
      version: 1,
      networks: {
        testnet: {
          contracts: {
            token: {
              contractId: "C".padEnd(56, "A"),
              wasmHash: "hash-token",
              deployedAt: "2026-05-12T00:00:00.000Z",
              sourcePath: "./contracts/token",
              wasmPath: "./contracts/token.wasm",
              dependencies: [],
            },
            marketplace: {
              contractId: "C".padEnd(56, "B"),
              wasmHash: "hash-marketplace",
              deployedAt: "2026-05-12T00:00:00.000Z",
              sourcePath: "./contracts/marketplace",
              wasmPath: "./contracts/marketplace.wasm",
              dependencies: ["token"],
              resolvedDeployArgs: {
                tokenContractId: "C".padEnd(56, "A"),
              },
            },
          },
          dependencyGraph: {
            token: [],
            marketplace: ["token"],
          },
        },
      },
    });

    expect(artifacts.networks.testnet.dependencyGraph?.marketplace).toEqual(["token"]);
  });
});
