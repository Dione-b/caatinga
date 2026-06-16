import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { createMinimalProject } from "./create-minimal-project.js";

describe("createMinimalProject", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a minimal cli plus soroban contract project without frontend files", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-minimal-project-"));
    const targetDir = path.join(tmpDir, "my-app");

    const result = await createMinimalProject({
      projectName: "my-app",
      targetDir
    });

    expect(result.targetDir).toBe(targetDir);
    await expect(access(path.join(targetDir, "caatinga.config.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(targetDir, "caatinga.artifacts.json"))).resolves.toBeUndefined();
    await expect(access(path.join(targetDir, "package.json"))).resolves.toBeUndefined();
    await expect(access(path.join(targetDir, "contracts", "app", "src", "lib.rs"))).resolves.toBeUndefined();

    const config = await readFile(path.join(targetDir, "caatinga.config.ts"), "utf8");
    expect(config).toContain('project: "my-app"');
    expect(config).not.toContain("frontend");
    expect(config).toContain('wasm: "./contracts/app/target/wasm32v1-none/release/app.wasm"');

    const packageJson = JSON.parse(await readFile(path.join(targetDir, "package.json"), "utf8"));
    expect(packageJson.devDependencies["@caatinga/core"]).toBeDefined();
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.scripts.invoke).toBeUndefined();
    expect(packageJson.scripts["read:hello"]).toContain("caatinga read app.hello");
    expect(packageJson.scripts["read:version"]).toContain("caatinga read app.version");
    expect(packageJson.scripts.doctor).toBe("caatinga doctor");

    const readme = await readFile(path.join(targetDir, "README.md"), "utf8");
    expect(readme).toContain("caatinga read app.hello");
    expect(readme).not.toContain("caatinga invoke app.hello");

    const contract = await readFile(path.join(targetDir, "contracts", "app", "src", "lib.rs"), "utf8");
    expect(contract).toContain("pub fn hello");
    expect(contract).toContain("pub fn version");

    const artifacts = await readArtifacts(targetDir);
    expect(artifacts.project).toBe("my-app");
    expect(Object.keys(artifacts.networks)).toEqual(["testnet"]);
  });

  it("fails instead of overwriting existing project files by default", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-minimal-project-"));
    const targetDir = path.join(tmpDir, "my-app");
    await createMinimalProject({ projectName: "my-app", targetDir });

    await expect(
      createMinimalProject({ projectName: "my-app", targetDir })
    ).rejects.toThrow();
  });
});
