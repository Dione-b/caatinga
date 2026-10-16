import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readVerificationKeyPublicSignals } from "./read-vk-public-signals.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-vk-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("readVerificationKeyPublicSignals", () => {
  it("should_read_the_count_from_ic", async () => {
    const target = path.join(tmpDir, "vk.json");
    // ic length is always publicSignals + 1, so 3 entries mean 2 public signals.
    await writeFile(
      target,
      JSON.stringify({
        ic: [
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ],
      })
    );

    await expect(readVerificationKeyPublicSignals(target)).resolves.toBe(2);
  });

  it("should_fall_back_to_the_legacy_vk_ic_name", async () => {
    const target = path.join(tmpDir, "vk.json");
    await writeFile(
      target,
      JSON.stringify({
        vk_ic: [
          ["1", "2", "3"],
          ["4", "5", "6"],
        ],
      })
    );

    await expect(readVerificationKeyPublicSignals(target)).resolves.toBe(1);
  });

  it("should_read_the_uppercase_IC_snarkjs_actually_exports", async () => {
    // The pinned snarkjs version exports `IC` (uppercase), not `ic`.
    const target = path.join(tmpDir, "vk.json");
    await writeFile(
      target,
      JSON.stringify({
        IC: [
          ["1", "2", "3"],
          ["4", "5", "6"],
        ],
      })
    );

    await expect(readVerificationKeyPublicSignals(target)).resolves.toBe(1);
  });

  it("should_prefer_the_explicit_nPublic_when_present", async () => {
    const target = path.join(tmpDir, "vk.json");
    await writeFile(
      target,
      JSON.stringify({
        IC: [
          ["1", "2", "3"],
          ["4", "5", "6"],
        ],
        nPublic: 7,
      })
    );

    await expect(readVerificationKeyPublicSignals(target)).resolves.toBe(7);
  });

  it("should_allow_a_circuit_with_no_public_signals", async () => {
    const target = path.join(tmpDir, "vk.json");
    await writeFile(target, JSON.stringify({ nPublic: 0, IC: [["1", "2", "3"]] }));

    await expect(readVerificationKeyPublicSignals(target)).resolves.toBe(0);
  });

  it("should_ignore_a_non_numeric_nPublic", async () => {
    const target = path.join(tmpDir, "vk.json");
    await writeFile(
      target,
      JSON.stringify({
        nPublic: "1",
        IC: [
          ["1", "2", "3"],
          ["4", "5", "6"],
        ],
      })
    );

    await expect(readVerificationKeyPublicSignals(target)).resolves.toBe(1);
  });

  it("should_fail_when_the_file_is_unreadable", async () => {
    await expect(
      readVerificationKeyPublicSignals(path.join(tmpDir, "missing.json"))
    ).rejects.toThrow(expect.objectContaining({ code: "ZK_VK_REQUIRED" }));
  });

  it("should_fail_when_the_ic_array_is_too_short", async () => {
    const target = path.join(tmpDir, "vk.json");
    await writeFile(target, JSON.stringify({ ic: [] }));

    await expect(readVerificationKeyPublicSignals(target)).rejects.toThrow(
      expect.objectContaining({ code: "ZK_VK_REQUIRED" })
    );
  });
});
