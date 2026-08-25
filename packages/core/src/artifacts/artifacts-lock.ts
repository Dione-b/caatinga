import { open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode, toCaatingaError } from "../errors/CaatingaError.js";

const LOCK_RETRY_DELAY_MS = 50;
const LOCK_TIMEOUT_MS = 15_000;

/** Written into the lockfile so a lock left behind by a dead process can be told apart from a live one. */
type LockOwner = {
  pid: number;
  since: number;
};

export type WithArtifactsLockOptions = {
  /** How long to wait for the lock before failing (default 15s). */
  timeoutMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readLockOwner(lockPath: string): Promise<LockOwner | undefined> {
  try {
    const raw = await readFile(lockPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as LockOwner).pid === "number" &&
      typeof (parsed as LockOwner).since === "number"
    ) {
      return parsed as LockOwner;
    }
  } catch {
    // Unreadable, still being written, or a lockfile from a Caatinga version
    // that wrote an empty file. Treated as "owner unknown" — never reclaimed.
  }

  return undefined;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Removes a lockfile whose owning process is gone.
 *
 * The rename is the exclusivity primitive: if two processes both see the same
 * stale lock, only one of them can move that path, and only that one deletes
 * it. The loser gets ENOENT and simply retries the create.
 *
 * Residual race: the owner is re-read immediately before the rename, but a
 * lock created by a third process in the microseconds between that read and
 * the rename could still be stolen. Making this airtight needs a lock
 * directory or an fcntl lock; this keeps the common case (a deploy killed by
 * Ctrl-C, a CI timeout or an OOM) self-healing without a rewrite.
 */
async function reclaimStaleLock(lockPath: string, staleOwner: LockOwner): Promise<boolean> {
  const current = await readLockOwner(lockPath);
  if (current?.pid !== staleOwner.pid || current.since !== staleOwner.since) {
    return false;
  }

  const stolenPath = `${lockPath}.stale-${process.pid}`;
  try {
    await rename(lockPath, stolenPath);
  } catch {
    return false;
  }

  await unlink(stolenPath).catch(() => undefined);
  return true;
}

function lockTimeoutError(lockPath: string, owner: LockOwner | undefined): CaatingaError {
  const heldFor =
    owner === undefined
      ? "The lockfile records no owner, so Caatinga cannot tell whether a process still holds it."
      : `Held by PID ${owner.pid} for ${Math.round(Math.max(0, Date.now() - owner.since) / 1000)}s.`;

  return new CaatingaError(
    `Timed out waiting for the artifacts lock at ${lockPath}.`,
    CaatingaErrorCode.ARTIFACTS_LOCK_TIMEOUT,
    [
      heldFor,
      "Another Caatinga process may be writing caatinga.artifacts.json.",
      `If none is running, remove ${lockPath} and retry.`,
    ].join(" ")
  );
}

async function acquireLock(lockPath: string, deadline: number): Promise<void> {
  while (true) {
    let owner: LockOwner | undefined;

    try {
      const handle = await open(lockPath, "wx");
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, since: Date.now() }));
      } finally {
        await handle.close();
      }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw toCaatingaError(error);
      }

      owner = await readLockOwner(lockPath);
      if (
        owner !== undefined &&
        !isProcessAlive(owner.pid) &&
        (await reclaimStaleLock(lockPath, owner))
      ) {
        continue;
      }
    }

    if (Date.now() >= deadline) {
      throw lockTimeoutError(lockPath, owner);
    }

    await sleep(LOCK_RETRY_DELAY_MS);
  }
}

/**
 * Serializes read-modify-write access to caatinga.artifacts.json across concurrent
 * Caatinga processes (e.g. two `ctg deploy` runs) using an exclusive-create lockfile.
 *
 * The lockfile carries the owning PID and a timestamp, so a lock left behind by
 * an interrupted run is reclaimed on the next attempt instead of blocking every
 * later run for the full timeout.
 */
export async function withArtifactsLock<T>(
  cwd: string,
  fn: () => Promise<T>,
  options: WithArtifactsLockOptions = {}
): Promise<T> {
  const artifactsPath = path.resolve(cwd, "caatinga.artifacts.json");
  const lockPath = `${artifactsPath}.lock`;

  await acquireLock(lockPath, Date.now() + (options.timeoutMs ?? LOCK_TIMEOUT_MS));
  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => undefined);
  }
}
