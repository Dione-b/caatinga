import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dependenciesDiagnostic } from "./dependencies-diagnostic.js";

describe("dependenciesDiagnostic", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_return_undefined_outside_a_caatinga_project", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deps-diag-"));

    await expect(dependenciesDiagnostic(tmpDir)).resolves.toBeUndefined();
  });

  it("should_fail_when_config_exists_but_node_modules_is_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deps-diag-"));
    await writeFile(path.join(tmpDir, "package.json"), "{}\n", "utf8");
    await writeFile(path.join(tmpDir, "caatinga.config.ts"), "export default {};\n", "utf8");

    const diagnostic = await dependenciesDiagnostic(tmpDir);

    expect(diagnostic).toMatchObject({
      ok: false,
      label: "Project dependencies not installed",
    });
  });

  it("should_pass_when_caatinga_core_is_installed", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-deps-diag-"));
    await writeFile(path.join(tmpDir, "package.json"), "{}\n", "utf8");
    await writeFile(path.join(tmpDir, "caatinga.config.ts"), "export default {};\n", "utf8");
    await mkdir(path.join(tmpDir, "node_modules", "@caatinga", "core"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "node_modules", "@caatinga", "core", "package.json"),
      "{}\n",
      "utf8"
    );

    const diagnostic = await dependenciesDiagnostic(tmpDir);

    expect(diagnostic).toMatchObject({
      ok: true,
      label: "Project dependencies installed",
    });
  });
});
