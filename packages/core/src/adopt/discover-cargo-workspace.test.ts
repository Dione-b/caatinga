import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  discoverCargoWorkspace,
  parseMemberCargoManifest,
  parseWorkspaceMembers,
  wasmArtifactNameCandidates,
} from "./discover-cargo-workspace.js";

async function writeManifest(root: string, memberPath: string, source: string): Promise<void> {
  const dir = path.join(root, memberPath);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "Cargo.toml"), source, "utf8");
}

const CONTRACT_MANIFEST = `# contract crate
[package]
name = "counter"
version = "0.1.0"

[lib]
crate-type = ["cdylib"]
`;

const DASHED_CONTRACT_MANIFEST = `# dashed crate name
[package]
name = "my-token"
version = "0.1.0"

[lib]
crate-type = ["cdylib"]
`;

const UTIL_MANIFEST = `[package]
name = "shared-utils"
version = "0.1.0"

[lib]
crate-type = ["rlib"]
`;

const ROOT_MANIFEST = `[workspace]
members = [
  "contracts/counter", # trailing comment
  "contracts/my-token",
  "shared",
]
`;

describe("parseWorkspaceMembers", () => {
  it("reads an inline members array", () => {
    expect(parseWorkspaceMembers(`[workspace]\nmembers = ["a", "b"]\n`)).toEqual(["a", "b"]);
  });

  it("reads a multi-line members array and skips comments", () => {
    const source = `[workspace]\nmembers = [\n  "contracts/counter", # main\n  "shared",\n]\n`;
    expect(parseWorkspaceMembers(source)).toEqual(["contracts/counter", "shared"]);
  });

  it("ignores members arrays outside [workspace]", () => {
    const source = `[package]\nmembers = ["not-workspace"]\n\n[workspace]\nmembers = ["real"]\n`;
    expect(parseWorkspaceMembers(source)).toEqual(["real"]);
  });
});

describe("parseMemberCargoManifest", () => {
  it("extracts the package name and cdylib crate type", () => {
    expect(parseMemberCargoManifest(CONTRACT_MANIFEST)).toEqual({
      packageName: "counter",
      isCdylib: true,
    });
  });

  it("reports plain library crates as non-contracts", () => {
    expect(parseMemberCargoManifest(UTIL_MANIFEST)).toEqual({
      packageName: "shared-utils",
      isCdylib: false,
    });
  });

  it("handles a manifest without a [lib] section", () => {
    expect(parseMemberCargoManifest(`[package]\nname = "bin-only"\n`)).toEqual({
      packageName: "bin-only",
      isCdylib: false,
    });
  });
});

describe("wasmArtifactNameCandidates", () => {
  it("probes both dash and underscore spellings without duplicates", () => {
    expect(wasmArtifactNameCandidates("my-token")).toEqual(["my-token", "my_token"]);
    expect(wasmArtifactNameCandidates("counter")).toEqual(["counter"]);
  });
});

describe("discoverCargoWorkspace", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      vi.unstubAllEnvs();
    }
  });

  it("discovers cdylib crates with their relative wasm paths", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(path.join(tmpDir, "Cargo.toml"), ROOT_MANIFEST, "utf8");
    await writeManifest(tmpDir, "contracts/counter", CONTRACT_MANIFEST);
    await writeManifest(tmpDir, "contracts/my-token", DASHED_CONTRACT_MANIFEST);
    await writeManifest(tmpDir, "shared", UTIL_MANIFEST);

    const discovery = await discoverCargoWorkspace(tmpDir);

    expect(discovery.workspaceRoot).toBe(path.resolve(tmpDir));
    expect(discovery.contracts).toHaveLength(2);
    expect(discovery.contracts.map((contract) => contract.name)).toEqual(["counter", "my-token"]);
    expect(discovery.contracts[0]).toMatchObject({
      memberPath: "contracts/counter",
      wasmPath: "contracts/counter/target/wasm32v1-none/release/counter.wasm",
      wasmOnDisk: false,
    });
  });

  it("prefers the underscore spelling when that wasm exists on disk", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(path.join(tmpDir, "Cargo.toml"), ROOT_MANIFEST, "utf8");
    await writeManifest(tmpDir, "contracts/my-token", DASHED_CONTRACT_MANIFEST);
    await writeManifest(
      tmpDir,
      "contracts/my-token/target/wasm32v1-none/release",
      ""
    );
    await writeFile(
      path.join(
        tmpDir,
        "contracts/my-token/target/wasm32v1-none/release/my_token.wasm"
      ),
      "wasm",
      "utf8"
    );

    const discovery = await discoverCargoWorkspace(tmpDir);

    expect(discovery.contracts[0]).toMatchObject({
      name: "my-token",
      wasmPath: "contracts/my-token/target/wasm32v1-none/release/my_token.wasm",
      wasmOnDisk: true,
    });
  });

  it("expands a one-level dir/* glob over directories with manifests", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(
      path.join(tmpDir, "Cargo.toml"),
      `[workspace]\nmembers = ["contracts/*"]\n`,
      "utf8"
    );
    await writeManifest(tmpDir, "contracts/counter", CONTRACT_MANIFEST);
    await writeManifest(tmpDir, "contracts/my-token", DASHED_CONTRACT_MANIFEST);
    // A stray directory with no manifest must not break discovery.
    await mkdir(path.join(tmpDir, "contracts/empty"), { recursive: true });

    const discovery = await discoverCargoWorkspace(tmpDir);

    expect(discovery.contracts.map((contract) => contract.name)).toEqual([
      "counter",
      "my-token",
    ]);
  });

  it("honors CARGO_TARGET_DIR for on-disk wasm probing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(path.join(tmpDir, "Cargo.toml"), ROOT_MANIFEST, "utf8");
    await writeManifest(tmpDir, "contracts/counter", CONTRACT_MANIFEST);
    const targetDir = path.join(tmpDir, "shared-target");
    await mkdir(path.join(targetDir, "wasm32v1-none", "release"), { recursive: true });
    await writeFile(
      path.join(targetDir, "wasm32v1-none", "release", "counter.wasm"),
      "wasm",
      "utf8"
    );
    vi.stubEnv("CARGO_TARGET_DIR", targetDir);

    const discovery = await discoverCargoWorkspace(tmpDir);

    expect(discovery.contracts[0]?.wasmOnDisk).toBe(true);
  });

  it("reports the workspace root [package] name when present", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(
      path.join(tmpDir, "Cargo.toml"),
      `[package]\nname = "my-project-root"\n\n[workspace]\nmembers = ["contracts/counter"]\n`,
      "utf8"
    );
    await writeManifest(tmpDir, "contracts/counter", CONTRACT_MANIFEST);

    const discovery = await discoverCargoWorkspace(tmpDir);

    expect(discovery.packageName).toBe("my-project-root");
  });

  it("fails with a CaatingaError when there is no root Cargo.toml", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));

    await expect(discoverCargoWorkspace(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.CONFIG_NOT_FOUND,
    });
    await expect(discoverCargoWorkspace(tmpDir)).rejects.toBeInstanceOf(CaatingaError);
  });

  it("fails when the workspace declares no members", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(path.join(tmpDir, "Cargo.toml"), `[workspace]\n`, "utf8");

    await expect(discoverCargoWorkspace(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.CONFIG_NOT_FOUND,
    });
  });

  it("fails when no member is a Soroban contract crate", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-disco-"));
    await writeFile(path.join(tmpDir, "Cargo.toml"), ROOT_MANIFEST, "utf8");
    await writeManifest(tmpDir, "shared", UTIL_MANIFEST);

    await expect(discoverCargoWorkspace(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.CONFIG_NOT_FOUND,
    });
  });
});
