import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteFile } from "./atomic-write-file.js";

describe("atomicWriteFile", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should_write_the_contents_and_leave_no_temp_file", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "caatinga-atomic-"));
    const target = path.join(dir, "out.json");

    await atomicWriteFile(target, "hello\n");

    expect(await readFile(target, "utf8")).toBe("hello\n");
    const leftovers = (await readdir(dir)).filter((name) => name.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("should_create_missing_parent_directories", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "caatinga-atomic-"));
    const target = path.join(dir, "nested", "deep", "out.txt");

    await atomicWriteFile(target, "ok");

    expect(await readFile(target, "utf8")).toBe("ok");
  });

  it("should_clean_up_the_temp_file_when_the_write_cannot_complete", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "caatinga-atomic-"));
    const target = path.join(dir, "blocked");
    // Make the target a directory: the final rename cannot replace it, simulating
    // an interrupted/failed commit. The temp file must not be left behind.
    await mkdir(target);

    await expect(atomicWriteFile(target, "data")).rejects.toBeDefined();

    const leftovers = (await readdir(dir)).filter((name) => name.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });
});
