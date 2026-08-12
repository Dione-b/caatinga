import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAATINGA_CORE_VERSION } from "../version.js";
import {
  TemplateManifestSchema,
  assertOfficialTemplateManifest,
  defaultCompatibleCoreRange,
} from "./template-manifest.schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const officialTemplatesDir = path.resolve(__dirname, "../../../templates");
const corePackageJsonPath = path.resolve(__dirname, "../../package.json");

async function listOfficialTemplateNames(): Promise<string[]> {
  const entries = await readdir(officialTemplatesDir);
  const templateNames: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(officialTemplatesDir, entry);
    const entryStat = await stat(entryPath);
    if (entryStat.isDirectory()) {
      templateNames.push(entry);
    }
  }

  return templateNames.sort();
}

describe("official template manifests", () => {
  it("should_match_CAATINGA_CORE_VERSION_with_package_json", async () => {
    const packageJson = JSON.parse(await readFile(corePackageJsonPath, "utf8")) as {
      version: string;
    };
    expect(CAATINGA_CORE_VERSION).toBe(packageJson.version);
  });

  it("should_pin_compatibleCore_to_defaultCompatibleCoreRange", async () => {
    expect(defaultCompatibleCoreRange()).toBe(`^${CAATINGA_CORE_VERSION}`);
  });

  it("should_keep_each_official_template_manifest_compatible_with_core", async () => {
    const templateNames = await listOfficialTemplateNames();
    expect(templateNames.length).toBeGreaterThan(0);
    expect(templateNames).toContain("react-vite-counter");
    expect(templateNames).toContain("zk-starter");

    for (const templateName of templateNames) {
      const manifestPath = path.join(officialTemplatesDir, templateName, "caatinga.template.json");
      const rawManifest = await readFile(manifestPath, "utf8");
      const manifest = TemplateManifestSchema.parse(JSON.parse(rawManifest));

      expect(() => assertOfficialTemplateManifest(manifest)).not.toThrow();
    }
  });

  it("should_declare_a_packages_field_in_every_template_pnpm_workspace_file", async () => {
    // pnpm 9 treats any directory holding pnpm-workspace.yaml as a workspace root and
    // aborts install *and* exec with "packages field missing or empty". Both templates
    // shipped a settings-only file, which broke `pnpm install` in scaffolded projects and
    // kept testnet-deploy-regression red for three weeks. See #124.
    const templateNames = await listOfficialTemplateNames();
    expect(templateNames.length).toBeGreaterThan(0);

    let checked = 0;
    for (const templateName of templateNames) {
      const workspacePath = path.join(officialTemplatesDir, templateName, "pnpm-workspace.yaml");
      const raw = await readFile(workspacePath, "utf8").catch(() => null);
      if (raw === null) {
        continue;
      }

      checked += 1;
      expect(raw, `${templateName}/pnpm-workspace.yaml has no packages field`).toMatch(
        /^packages:/m
      );
    }

    // Guards the guard: if the files are ever renamed, this test must not silently pass.
    expect(checked).toBeGreaterThan(0);
  });
});
