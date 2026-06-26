import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  patchGeneratedBindingPackage,
  POLYFILLS_CONTENT,
  POLYFILLS_FILENAME,
  POLYFILLS_IMPORT_LINE,
  ROOT_BINDING_INDEX_CONTENT,
} from "./patch-generated-binding-package.js";

describe("patchGeneratedBindingPackage", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function writeSdkLikePackage(outputDir: string): Promise<void> {
    await mkdir(path.join(outputDir, "src"), { recursive: true });
    await writeFile(path.join(outputDir, "src", "index.ts"), "export class Client {}\n", "utf8");
    await writeFile(
      path.join(outputDir, "package.json"),
      `${JSON.stringify(
        {
          name: "counter",
          version: "0.0.1",
          type: "module",
          main: "dist/index.js",
          types: "dist/index.d.ts",
          exports: {
            ".": {
              import: "./dist/index.js",
              types: "./dist/index.d.ts",
            },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  it("should_rewrite_main_types_and_exports_to_src_index_ts_when_pointing_to_dist", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-"));
    await writeSdkLikePackage(tmpDir);

    await patchGeneratedBindingPackage(tmpDir);

    const packageJson = JSON.parse(await readFile(path.join(tmpDir, "package.json"), "utf8"));
    expect(packageJson.main).toBe("./src/index.ts");
    expect(packageJson.types).toBe("./src/index.ts");
    expect(packageJson.exports["."]).toBe("./src/index.ts");
    expect(packageJson.name).toBe("counter");
    expect(await readFile(path.join(tmpDir, "index.ts"), "utf8")).toBe(ROOT_BINDING_INDEX_CONTENT);
  });

  it("should_be_idempotent_when_package_already_points_to_src", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-idempotent-"));
    await writeSdkLikePackage(tmpDir);

    await patchGeneratedBindingPackage(tmpDir);
    const firstPass = await readFile(path.join(tmpDir, "package.json"), "utf8");

    await patchGeneratedBindingPackage(tmpDir);
    const secondPass = await readFile(path.join(tmpDir, "package.json"), "utf8");

    expect(secondPass).toBe(firstPass);
    expect(await readFile(path.join(tmpDir, "index.ts"), "utf8")).toBe(ROOT_BINDING_INDEX_CONTENT);
  });

  it("should_create_root_index_ts_when_package_json_already_points_to_src", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-root-index-"));
    await mkdir(path.join(tmpDir, "src"), { recursive: true });
    await writeFile(path.join(tmpDir, "src", "index.ts"), "export class Client {}\n", "utf8");
    await writeFile(
      path.join(tmpDir, "package.json"),
      `${JSON.stringify(
        {
          name: "counter",
          version: "0.0.1",
          type: "module",
          main: "./src/index.ts",
          types: "./src/index.ts",
          exports: { ".": "./src/index.ts" },
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await patchGeneratedBindingPackage(tmpDir);

    expect(await readFile(path.join(tmpDir, "index.ts"), "utf8")).toBe(ROOT_BINDING_INDEX_CONTENT);
  });

  it("should_not_overwrite_custom_root_index_ts_from_generator", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-custom-root-"));
    await writeSdkLikePackage(tmpDir);
    const customRoot = 'export { Client } from "./src/index.js";\n';
    await writeFile(path.join(tmpDir, "index.ts"), customRoot, "utf8");

    await patchGeneratedBindingPackage(tmpDir);

    expect(await readFile(path.join(tmpDir, "index.ts"), "utf8")).toBe(customRoot);
  });

  it("should_write_buffer_polyfill_and_import_it_from_src_index", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-polyfill-"));
    await writeSdkLikePackage(tmpDir);

    await patchGeneratedBindingPackage(tmpDir);

    expect(await readFile(path.join(tmpDir, "src", POLYFILLS_FILENAME), "utf8")).toBe(
      POLYFILLS_CONTENT
    );
    const entry = await readFile(path.join(tmpDir, "src", "index.ts"), "utf8");
    expect(entry.startsWith(`${POLYFILLS_IMPORT_LINE}\n`)).toBe(true);
    expect(entry).toContain("export class Client {}");
  });

  it("should_not_duplicate_polyfill_import_on_repeated_patch", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-polyfill-idempotent-"));
    await writeSdkLikePackage(tmpDir);

    await patchGeneratedBindingPackage(tmpDir);
    await patchGeneratedBindingPackage(tmpDir);

    const entry = await readFile(path.join(tmpDir, "src", "index.ts"), "utf8");
    const occurrences = entry.split(POLYFILLS_IMPORT_LINE).length - 1;
    expect(occurrences).toBe(1);
  });

  it("should_throw_BINDINGS_FAILED_when_src_index_ts_is_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-missing-"));
    await writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ main: "dist/index.js" }),
      "utf8"
    );

    await expect(patchGeneratedBindingPackage(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.BINDINGS_FAILED,
      message: "Generated binding package is missing src/index.ts.",
    });
  });

  it("should_throw_BINDINGS_FAILED_when_package_json_is_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-no-pkg-"));
    await mkdir(path.join(tmpDir, "src"), { recursive: true });
    await writeFile(path.join(tmpDir, "src", "index.ts"), "export class Client {}\n", "utf8");

    await expect(patchGeneratedBindingPackage(tmpDir)).rejects.toMatchObject({
      code: CaatingaErrorCode.BINDINGS_FAILED,
      message: "Generated binding package is missing package.json.",
    });
  });

  it("should_skip_rewrite_when_stub_already_matches_bundler_entry", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-patch-skip-"));
    await mkdir(path.join(tmpDir, "src"), { recursive: true });
    await writeFile(path.join(tmpDir, "src", "index.ts"), "export class Client {}\n", "utf8");

    const stubPackage = {
      name: "counter",
      version: "0.0.1",
      type: "module",
      main: "./src/index.ts",
      types: "./src/index.ts",
      exports: { ".": "./src/index.ts" },
    };
    const stubRaw = `${JSON.stringify(stubPackage, null, 2)}\n`;
    await writeFile(path.join(tmpDir, "package.json"), stubRaw, "utf8");

    await patchGeneratedBindingPackage(tmpDir);

    await expect(access(path.join(tmpDir, "package.json"))).resolves.toBeUndefined();
    expect(await readFile(path.join(tmpDir, "package.json"), "utf8")).toBe(stubRaw);
    expect(await readFile(path.join(tmpDir, "index.ts"), "utf8")).toBe(ROOT_BINDING_INDEX_CONTENT);
  });
});
