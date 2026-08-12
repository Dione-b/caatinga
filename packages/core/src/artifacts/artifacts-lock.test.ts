import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
    wasmHash: "hash",
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

    await Promise.all([deploy("alpha", "CALPHA"), deploy("beta", "CBETA")]);

    const artifacts = await readArtifacts(cwd);
    expect(artifacts.networks.testnet?.contracts.alpha?.contractId).toBe("CALPHA");
    expect(artifacts.networks.testnet?.contracts.beta?.contractId).toBe("CBETA");
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
