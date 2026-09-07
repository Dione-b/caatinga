import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { withArtifactsLock } from "./artifacts-lock.js";
import { readArtifacts } from "./read-artifacts.js";
import { updateArtifact } from "./update-artifact.js";
import { createInitialArtifacts, writeArtifacts } from "./write-artifacts.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function contractRecord(contractId: string) {
  return {
    contractId,
    wasmHash: "a".repeat(64),
    deployedAt: "2026-06-25T00:00:00.000Z",
    sourcePath: "./contracts/x",
    wasmPath: "./target/x.wasm",
    dependencies: [],
    resolvedDeployArgs: {},
  };
}

describe("withArtifactsLock", () => {
  it("serializes concurrent read-modify-write cycles without losing writes", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-lock-"));
    tempDirs.push(cwd);

    await writeArtifacts(createInitialArtifacts("demo", { networks: ["testnet"] }), cwd);

    const deploy = (name: string, contractId: string) =>
      withArtifactsLock(cwd, async () => {
        const latest = await readArtifacts(cwd);
        // Widen the read-modify-write window so an unserialized run would lose a write.
        await new Promise((resolve) => setTimeout(resolve, 20));
        const next = updateArtifact(latest, "testnet", name, contractRecord(contractId));
        return writeArtifacts(next, cwd);
      });

    const alphaId = "C".padEnd(56, "A");
    const betaId = "C".padEnd(56, "B");
    await Promise.all([deploy("alpha", alphaId), deploy("beta", betaId)]);

    const artifacts = await readArtifacts(cwd);
    expect(artifacts.networks.testnet?.contracts.alpha?.contractId).toBe(alphaId);
    expect(artifacts.networks.testnet?.contracts.beta?.contractId).toBe(betaId);
  });

  it("releases the lock when the callback throws", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-lock-"));
    tempDirs.push(cwd);

    await expect(withArtifactsLock(cwd, () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom"
    );

    await expect(withArtifactsLock(cwd, () => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});

/** A PID that is guaranteed to have exited, so the lock it "holds" is stale. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((resolve) => child.on("close", resolve));
  return child.pid as number;
}

function lockPathFor(cwd: string): string {
  return path.join(cwd, "caatinga.artifacts.json.lock");
}

describe("withArtifactsLock stale lock handling", () => {
  it("should_record_the_owning_pid_in_the_lockfile", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-lock-"));
    tempDirs.push(cwd);

    const owner = await withArtifactsLock(cwd, async () =>
      JSON.parse(await readFile(lockPathFor(cwd), "utf8"))
    );

    expect(owner.pid).toBe(process.pid);
    expect(typeof owner.since).toBe("number");
  });

  it("should_reclaim_a_lock_left_behind_by_a_dead_process", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-lock-"));
    tempDirs.push(cwd);

    await writeFile(
      lockPathFor(cwd),
      JSON.stringify({ pid: await deadPid(), since: Date.now() - 60_000 }),
      "utf8"
    );

    const startedAt = Date.now();
    // No timeoutMs override on purpose: the point is that the default 15s wait
    // is never entered when the owner is gone.
    await expect(withArtifactsLock(cwd, () => Promise.resolve("ok"))).resolves.toBe("ok");
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it("should_throw_ARTIFACTS_LOCK_TIMEOUT_naming_the_live_owner", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-lock-"));
    tempDirs.push(cwd);

    await withArtifactsLock(cwd, async () => {
      await expect(
        withArtifactsLock(cwd, () => Promise.resolve("inner"), { timeoutMs: 100 })
      ).rejects.toMatchObject({
        code: CaatingaErrorCode.ARTIFACTS_LOCK_TIMEOUT,
        hint: expect.stringContaining(`PID ${process.pid}`),
      });
    });
  });

  it("should_not_reclaim_a_lockfile_that_records_no_owner", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-lock-"));
    tempDirs.push(cwd);

    await writeFile(lockPathFor(cwd), "", "utf8");

    await expect(
      withArtifactsLock(cwd, () => Promise.resolve("ok"), { timeoutMs: 100 })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.ARTIFACTS_LOCK_TIMEOUT,
      hint: expect.stringContaining("no owner"),
    });
  });
});
