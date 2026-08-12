import { open, unlink } from "node:fs/promises";
import path from "node:path";

const LOCK_RETRY_DELAY_MS = 50;
const LOCK_TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireLock(lockPath: string, deadline: number): Promise<void> {
  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out waiting for lock on ${lockPath}. Remove it manually if no other Caatinga process is running.`
        );
      }
      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }
}

/**
 * Serializes read-modify-write access to caatinga.artifacts.json across concurrent
 * Caatinga processes (e.g. two `ctg deploy` runs) using an exclusive-create lockfile.
 */
export async function withArtifactsLock<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const artifactsPath = path.resolve(cwd, "caatinga.artifacts.json");
  const lockPath = `${artifactsPath}.lock`;

  await acquireLock(lockPath, Date.now() + LOCK_TIMEOUT_MS);
  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => undefined);
  }
}
