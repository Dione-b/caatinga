import { randomBytes } from "node:crypto";
import { chmod, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";

type WriteTarget = {
  path: string;
  mode?: number;
};

async function resolveWriteTarget(filePath: string): Promise<WriteTarget> {
  try {
    const resolved = await realpath(filePath);
    const { mode } = await stat(resolved);
    return { path: resolved, mode: mode & 0o777 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path: filePath };
    }
    throw error;
  }
}

export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const target = await resolveWriteTarget(filePath);
  const tmpPath = `${target.path}.${randomBytes(4).toString("hex")}.tmp`;

  try {
    await writeFile(tmpPath, data, "utf8");
    if (target.mode !== undefined) {
      await chmod(tmpPath, target.mode);
    }
    await rename(tmpPath, target.path);
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}
