import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import { checkBinary } from "../shell/check-binary.js";

describe("recovery scenarios", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
    runCommand.mockReset();
  });

  it("should_return_CAATINGA_ARTIFACT_NOT_FOUND_when_artifacts_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-recovery-"));
    await expect(readArtifacts(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      hint: expect.stringContaining("ctg init"),
    });
  });

  it("should_return_CAATINGA_ARTIFACT_INVALID_for_corrupted_json", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-recovery-"));
    await writeFile(path.join(tmpDir, "caatinga.artifacts.json"), "{not-json", "utf8");
    await expect(readArtifacts(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACT_INVALID,
      hint: expect.stringContaining("Fix the JSON shape"),
    });
  });

  it("should_return_CAATINGA_STELLAR_CLI_NOT_FOUND_for_missing_binary", async () => {
    runCommand.mockRejectedValueOnce(new Error("not found"));

    await expect(
      checkBinary("stellar", "Install Stellar CLI using the official Stellar setup guide.")
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
      hint: expect.stringContaining("Install Stellar CLI"),
    });
  });

  it("should_leave_valid_artifacts_when_atomic_write_succeeds", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-recovery-"));
    const initial = createInitialArtifacts("recovery-app", { networks: ["testnet"] });
    await writeArtifacts(initial, tmpDir);

    const raw = await readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).version).toBe(2);
  });
});
