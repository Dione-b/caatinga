import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BINDING_MARKER_FILENAME,
  readBindingMarker,
  writeBindingMarker,
  type BindingMarker
} from "./binding-marker.js";

const marker: BindingMarker = {
  version: 1,
  contractId: `C${"2".repeat(55)}`,
  wasmHash: "abc123",
  network: "testnet",
  generatedAt: "2026-06-11T12:00:00.000Z"
};

describe("binding-marker", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_round_trip_marker_write_and_read", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-marker-"));

    await writeBindingMarker(tmpDir, marker);

    await expect(readBindingMarker(tmpDir)).resolves.toEqual(marker);
  });

  it("should_return_null_when_marker_file_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-marker-"));

    await expect(readBindingMarker(tmpDir)).resolves.toBeNull();
  });

  it("should_return_null_on_invalid_json", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-marker-"));
    await writeFile(path.join(tmpDir, BINDING_MARKER_FILENAME), "{not json", "utf8");

    await expect(readBindingMarker(tmpDir)).resolves.toBeNull();
  });

  it("should_return_null_on_schema_mismatch", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-marker-"));
    await writeFile(
      path.join(tmpDir, BINDING_MARKER_FILENAME),
      JSON.stringify({ version: 2, contractId: "C123" }),
      "utf8"
    );

    await expect(readBindingMarker(tmpDir)).resolves.toBeNull();
  });
});
