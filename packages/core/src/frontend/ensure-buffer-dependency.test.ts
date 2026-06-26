import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureBufferDependency } from "./ensure-buffer-dependency.js";

describe("ensureBufferDependency", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function scaffold(frontendPkg: Record<string, unknown>): Promise<string> {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-buffer-dep-"));
    const frontendDir = path.join(tmpDir, "frontend");
    await mkdir(path.join(frontendDir, "src", "contracts"), { recursive: true });
    await writeFile(
      path.join(frontendDir, "package.json"),
      `${JSON.stringify(frontendPkg, null, 2)}\n`,
      "utf8"
    );
    return tmpDir;
  }

  it("should_add_buffer_to_the_nearest_frontend_package_json", async () => {
    const cwd = await scaffold({ name: "app", dependencies: { react: "^18.0.0" } });

    const result = await ensureBufferDependency(cwd, "./frontend/src/contracts");

    expect(result?.added).toBe(true);
    const pkg = JSON.parse(
      await readFile(path.join(cwd, "frontend", "package.json"), "utf8")
    );
    expect(pkg.dependencies.buffer).toBeDefined();
    expect(pkg.dependencies.react).toBe("^18.0.0");
  });

  it("should_be_a_noop_when_buffer_is_already_declared", async () => {
    const cwd = await scaffold({ name: "app", dependencies: { buffer: "^6.0.3" } });

    const result = await ensureBufferDependency(cwd, "./frontend/src/contracts");

    expect(result?.added).toBe(false);
  });

  it("should_detect_buffer_in_devDependencies", async () => {
    const cwd = await scaffold({ name: "app", devDependencies: { buffer: "^6.0.3" } });

    const result = await ensureBufferDependency(cwd, "./frontend/src/contracts");

    expect(result?.added).toBe(false);
  });

  it("should_return_undefined_when_no_package_json_is_found", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-buffer-dep-none-"));
    await mkdir(path.join(tmpDir, "frontend", "src", "contracts"), { recursive: true });

    const result = await ensureBufferDependency(tmpDir, "./frontend/src/contracts");

    expect(result).toBeUndefined();
  });
});
