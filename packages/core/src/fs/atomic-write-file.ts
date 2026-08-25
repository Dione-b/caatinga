import { randomBytes } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Write `contents` to `filePath` atomically: write to a unique temp file in the
 * same directory, then `rename` it into place. A rename on the same filesystem
 * is atomic, so a reader never observes a half-written file and a crash mid-write
 * can't corrupt the target — it leaves the old file intact (#84).
 *
 * Creates the parent directory if needed and removes the temp file on failure.
 */
export async function atomicWriteFile(filePath: string, contents: string): Promise<void> {
  const resolved = path.resolve(filePath);
  await mkdir(path.dirname(resolved), { recursive: true });

  const tmpPath = `${resolved}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(tmpPath, contents, "utf8");
    await rename(tmpPath, resolved);
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}
