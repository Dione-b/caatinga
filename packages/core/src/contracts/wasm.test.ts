import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  CURRENT_RUST_WASM_TARGET,
  LEGACY_RUST_WASM_TARGET,
  resolveWasmArtifactPath,
  toCurrentWasmTargetPath,
} from "./wasm.js";

describe("wasm target paths", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_map_legacy_wasm32_unknown_unknown_paths_to_wasm32v1_none", () => {
    const legacy = `./contracts/counter/target/${LEGACY_RUST_WASM_TARGET}/release/counter.wasm`;

    expect(toCurrentWasmTargetPath(legacy)).toBe(
      `./contracts/counter/target/${CURRENT_RUST_WASM_TARGET}/release/counter.wasm`
    );
  });

  it("should_resolve_configured_wasm_path_when_file_exists", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wasm-"));
    const wasmPath = path.join(tmpDir, "counter.wasm");
    await writeFile(wasmPath, Buffer.from("wasm"), "utf8");

    await expect(resolveWasmArtifactPath(wasmPath)).resolves.toBe(wasmPath);
  });

  it("should_resolve_legacy_configured_path_when_only_wasm32v1_none_output_exists", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wasm-"));
    const legacyPath = path.join(
      tmpDir,
      "contracts",
      "counter",
      "target",
      LEGACY_RUST_WASM_TARGET,
      "release",
      "counter.wasm"
    );
    const currentPath = toCurrentWasmTargetPath(legacyPath);
    await mkdir(path.dirname(currentPath), { recursive: true });
    await writeFile(currentPath, Buffer.from("wasm"), "utf8");

    await expect(resolveWasmArtifactPath(legacyPath)).resolves.toBe(currentPath);
    await expect(access(legacyPath)).rejects.toBeDefined();
  });

  it("should_throw_CAATINGA_ARTIFACT_NOT_FOUND_when_neither_legacy_nor_current_path_exists", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wasm-"));
    const legacyPath = path.join(
      tmpDir,
      "contracts",
      "counter",
      "target",
      LEGACY_RUST_WASM_TARGET,
      "release",
      "counter.wasm"
    );

    await expect(resolveWasmArtifactPath(legacyPath)).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACT_NOT_FOUND,
    });
  });

  it("should_resolve_wasm_under_CARGO_TARGET_DIR_when_configured_path_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wasm-"));
    const cargoTargetDir = path.join(tmpDir, "cargo-target");
    const configuredPath = path.join(
      tmpDir,
      "contracts",
      "counter",
      "target",
      CURRENT_RUST_WASM_TARGET,
      "release",
      "counter.wasm"
    );
    const actualWasmPath = path.join(
      cargoTargetDir,
      CURRENT_RUST_WASM_TARGET,
      "release",
      "counter.wasm"
    );

    await mkdir(path.dirname(actualWasmPath), { recursive: true });
    await writeFile(actualWasmPath, Buffer.from("wasm"), "utf8");

    const previous = process.env.CARGO_TARGET_DIR;
    process.env.CARGO_TARGET_DIR = cargoTargetDir;
    try {
      await expect(resolveWasmArtifactPath(configuredPath)).resolves.toBe(actualWasmPath);
    } finally {
      if (previous === undefined) {
        delete process.env.CARGO_TARGET_DIR;
      } else {
        process.env.CARGO_TARGET_DIR = previous;
      }
    }
  });

  it("should_include_CARGO_TARGET_DIR_hint_when_wasm_not_found_and_env_is_set", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wasm-"));
    const configuredPath = path.join(tmpDir, "missing", "counter.wasm");
    const cargoTargetDir = path.join(tmpDir, "cargo-target");

    const previous = process.env.CARGO_TARGET_DIR;
    process.env.CARGO_TARGET_DIR = cargoTargetDir;
    try {
      await expect(resolveWasmArtifactPath(configuredPath)).rejects.toMatchObject({
        code: CaatingaErrorCode.ARTIFACT_NOT_FOUND,
        hint: expect.stringContaining("CARGO_TARGET_DIR"),
      });
    } finally {
      if (previous === undefined) {
        delete process.env.CARGO_TARGET_DIR;
      } else {
        process.env.CARGO_TARGET_DIR = previous;
      }
    }
  });
});
