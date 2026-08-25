import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "./CaatingaError.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";

// #88: raw NodeJS.ErrnoException errors used to escape core catch blocks
// untyped. These exercise the converted sites with a real (non-ENOENT,
// non-SyntaxError) fs failure and assert they now surface as CaatingaError.
describe("core catch blocks wrap raw errors as CaatingaError (#88)", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("writeArtifacts wraps a raw rename failure", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wrap-"));
    // A directory at the artifacts path makes the atomic rename fail with a
    // raw fs error (EISDIR/ENOTEMPTY), not an ENOENT the code handles.
    await mkdir(path.join(tmpDir, "caatinga.artifacts.json"));

    await expect(writeArtifacts(createInitialArtifacts("app"), tmpDir)).rejects.toBeInstanceOf(
      CaatingaError
    );
  });

  it("readArtifacts wraps a raw read failure", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-wrap-"));
    // Reading the artifacts path when it is a directory throws EISDIR — a raw
    // error distinct from the ENOENT (missing file) the code returns empty for.
    await mkdir(path.join(tmpDir, "caatinga.artifacts.json"));

    await expect(readArtifacts(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.UNEXPECTED_ERROR,
    });
  });
});
