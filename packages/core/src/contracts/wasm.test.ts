import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  CURRENT_RUST_WASM_TARGET,
  LEGACY_RUST_WASM_TARGET,
  resolveWasmArtifactPath,
  toCurrentWasmTargetPath
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
      code: CaatingaErrorCode.ARTIFACT_NOT_FOUND
    });
  });
});
