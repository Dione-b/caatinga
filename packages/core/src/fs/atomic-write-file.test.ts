import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { atomicWriteFile } from "./atomic-write-file.js";

const failures = vi.hoisted(() => ({ rename: false, writeFile: false }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (failures.rename) {
        throw Object.assign(new Error("simulated interruption"), { code: "EIO" });
      }
      return actual.rename(...args);
    },
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      if (failures.writeFile) {
        await actual.writeFile(args[0], "partial");
        throw Object.assign(new Error("simulated disk full"), { code: "ENOSPC" });
      }
      return actual.writeFile(...args);
    },
  };
});

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "caatinga-atomic-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  failures.rename = false;
  failures.writeFile = false;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("atomicWriteFile", () => {
  it("should_create_file_when_missing", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "out.json");

    await atomicWriteFile(filePath, "{}\n");

    expect(await readFile(filePath, "utf8")).toBe("{}\n");
    expect(await readdir(dir)).toEqual(["out.json"]);
  });

  it("should_replace_existing_content", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "package.json");
    await writeFile(filePath, "old", "utf8");

    await atomicWriteFile(filePath, "new");

    expect(await readFile(filePath, "utf8")).toBe("new");
  });

  it.skipIf(process.platform === "win32")("should_preserve_existing_file_mode", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, ".env.local");
    await writeFile(filePath, "A=1\n", "utf8");
    await chmod(filePath, 0o600);

    await atomicWriteFile(filePath, "A=2\n");

    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it.skipIf(process.platform === "win32")("should_write_through_symlinks", async () => {
    const dir = await makeTempDir();
    const realPath = path.join(dir, "shared.env");
    const linkPath = path.join(dir, ".env.local");
    await writeFile(realPath, "A=1\n", "utf8");
    await symlink(realPath, linkPath);

    await atomicWriteFile(linkPath, "A=2\n");

    expect(await readFile(realPath, "utf8")).toBe("A=2\n");
    expect((await stat(linkPath)).isFile()).toBe(true);
    expect(await readFile(linkPath, "utf8")).toBe("A=2\n");
  });

  it("should_keep_original_and_remove_temp_file_when_rename_is_interrupted", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "package.json");
    await writeFile(filePath, '{"name":"app"}\n', "utf8");
    failures.rename = true;

    await expect(atomicWriteFile(filePath, '{"name":"changed"}\n')).rejects.toMatchObject({
      code: "EIO",
    });

    expect(await readFile(filePath, "utf8")).toBe('{"name":"app"}\n');
    expect(await readdir(dir)).toEqual(["package.json"]);
  });

  it("should_keep_original_and_remove_partial_temp_file_when_write_fails", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, ".caatinga-bindings.json");
    await writeFile(filePath, "original", "utf8");
    failures.writeFile = true;

    await expect(atomicWriteFile(filePath, "replacement")).rejects.toMatchObject({
      code: "ENOSPC",
    });

    expect(await readFile(filePath, "utf8")).toBe("original");
    expect(await readdir(dir)).toEqual([".caatinga-bindings.json"]);
  });
});
