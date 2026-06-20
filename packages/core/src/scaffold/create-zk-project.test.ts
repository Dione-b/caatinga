import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { createZkProject } from "./create-zk-project.js";

describe("createZkProject", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a minimal zk-only project without frontend files", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-project-"));
    const targetDir = path.join(tmpDir, "my-zk-app");

    const result = await createZkProject({
      projectName: "my-zk-app",
      targetDir,
    });

    expect(result.targetDir).toBe(targetDir);
    await expect(access(path.join(targetDir, "caatinga.config.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(targetDir, "caatinga.artifacts.json"))).resolves.toBeUndefined();
    await expect(access(path.join(targetDir, "package.json"))).resolves.toBeUndefined();
    await expect(access(path.join(targetDir, "circuits", "main.circom"))).resolves.toBeUndefined();
    await expect(
      access(path.join(targetDir, "contracts", "verifier", "src", "lib.rs"))
    ).resolves.toBeUndefined();

    const config = await readFile(path.join(targetDir, "caatinga.config.ts"), "utf8");
    expect(config).toContain('project: "my-zk-app"');
    expect(config).not.toContain("frontend");
    expect(config).toContain(
      'wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm"'
    );
    expect(config).toContain('path: "./circuits"');
    expect(config).toContain('protocol: "groth16"');
    expect(config).toContain('curve: "bls12381"');
    expect(config).toContain('verifierContract: "verifier"');

    const circuit = await readFile(path.join(targetDir, "circuits", "main.circom"), "utf8");
    expect(circuit).toContain("template Main()");
    expect(circuit).not.toContain("Multiplier");

    const input = JSON.parse(
      await readFile(path.join(targetDir, "circuits", "input.json"), "utf8")
    );
    expect(input).toEqual({ a: "1" });

    const artifacts = await readArtifacts(targetDir);
    expect(artifacts.project).toBe("my-zk-app");
    expect(Object.keys(artifacts.networks)).toEqual(["testnet"]);

    const packageJson = JSON.parse(await readFile(path.join(targetDir, "package.json"), "utf8"));
    expect(packageJson.scripts.deploy).toBe(
      "caatinga deploy verifier --network testnet --source ${CAATINGA_SOURCE:-alice}"
    );
    expect(packageJson.scripts.doctor).toBe("caatinga doctor --network testnet");
    expect(packageJson.scripts.test).toBe(
      "cargo test --manifest-path contracts/verifier/Cargo.toml"
    );

    const readme = await readFile(path.join(targetDir, "README.md"), "utf8");
    expect(readme).toContain("npx caatinga deploy verifier --network testnet --source <identity>");
  });

  it("fails instead of overwriting existing project files by default", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-project-"));
    const targetDir = path.join(tmpDir, "my-zk-app");
    await createZkProject({ projectName: "my-zk-app", targetDir });

    await expect(createZkProject({ projectName: "my-zk-app", targetDir })).rejects.toThrow();
  });
});
