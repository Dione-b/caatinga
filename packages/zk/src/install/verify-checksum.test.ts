import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sha256File, verifyFileChecksum } from "./verify-checksum.js";

let dir: string;
let filePath: string;

const EXPECTED = "a".repeat(64);

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "caatinga-checksum-"));
  filePath = path.join(dir, "circom");
  await writeFile(filePath, "binary-bytes");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/**
 * Awaits a rejection and hands back the ZkError, so `hint` is directly
 * addressable. `catch`'s inferred return type keeps `void` in the union, which
 * then fights the property access.
 */
async function rejectionOf(
  run: () => Promise<unknown>
): Promise<{ message: string; hint: string }> {
  try {
    await run();
  } catch (error) {
    return error as { message: string; hint: string };
  }
  throw new Error("expected the operation to fail, but it resolved");
}

describe("sha256File", () => {
  it("should_hash_the_file_contents", async () => {
    await expect(sha256File(filePath)).resolves.toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("verifyFileChecksum", () => {
  it("should_pass_when_the_hash_matches", async () => {
    const actual = await sha256File(filePath);

    await expect(verifyFileChecksum(filePath, actual, "circom")).resolves.toBeUndefined();
  });

  it("should_match_case_insensitively", async () => {
    const actual = await sha256File(filePath);

    await expect(
      verifyFileChecksum(filePath, actual.toUpperCase(), "circom")
    ).resolves.toBeUndefined();
  });

  it("should_delete_the_file_and_raise_on_mismatch", async () => {
    await expect(verifyFileChecksum(filePath, EXPECTED, "circom")).rejects.toMatchObject({
      code: "ZK_CHECKSUM_MISMATCH",
    });

    await expect(sha256File(filePath)).rejects.toThrow();
  });

  it("should_point_at_the_release_page_and_download_url", async () => {
    await expect(
      verifyFileChecksum(filePath, EXPECTED, "circom v2.1.9 (circom-linux-amd64)", {
        version: "2.1.9",
        downloadUrl: "https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64",
        releaseUrl: "https://github.com/iden3/circom/releases/tag/v2.1.9",
      })
    ).rejects.toMatchObject({
      code: "ZK_CHECKSUM_MISMATCH",
      hint: expect.stringContaining("https://github.com/iden3/circom/releases/tag/v2.1.9"),
    });
  });

  it("should_include_the_download_url_and_the_pinned_file_in_the_hint", async () => {
    const error = await rejectionOf(() =>
      verifyFileChecksum(filePath, EXPECTED, "circom v2.1.9 (circom-linux-amd64)", {
        downloadUrl: "https://github.com/iden3/circom/releases/download/v2.1.9/x",
      })
    );

    expect(error.hint).toContain("https://github.com/iden3/circom/releases/download/v2.1.9/x");
    expect(error.hint).toContain("lazy-install-zk-tools.ts");
    expect(error.hint).toContain("supply-chain compromise");
  });

  it("should_stay_actionable_when_no_context_is_supplied", async () => {
    const error = await rejectionOf(() => verifyFileChecksum(filePath, EXPECTED, "circom"));

    expect(error.hint).toContain("Do not retry blindly");
    expect(error.hint).toContain("upstream GitHub release");
  });
});
