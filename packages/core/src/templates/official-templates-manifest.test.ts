import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAATINGA_CORE_VERSION } from "../version.js";
import {
  TemplateManifestSchema,
  assertOfficialTemplateManifest,
  defaultCompatibleCoreRange
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
    const packageJson = JSON.parse(await readFile(corePackageJsonPath, "utf8")) as { version: string };
    expect(CAATINGA_CORE_VERSION).toBe(packageJson.version);
  });

  it("should_pin_compatibleCore_to_defaultCompatibleCoreRange", async () => {
    expect(defaultCompatibleCoreRange()).toBe(`^${CAATINGA_CORE_VERSION}`);
  });

  it("should_keep_each_official_template_manifest_compatible_with_core", async () => {
    const templateNames = await listOfficialTemplateNames();
    expect(templateNames.length).toBeGreaterThan(0);
    expect(templateNames).toContain("marketplace-with-token");
    expect(templateNames).toContain("zk-starter");

    for (const templateName of templateNames) {
      const manifestPath = path.join(officialTemplatesDir, templateName, "caatinga.template.json");
      const rawManifest = await readFile(manifestPath, "utf8");
      const manifest = TemplateManifestSchema.parse(JSON.parse(rawManifest));

      expect(() => assertOfficialTemplateManifest(manifest)).not.toThrow();
    }
  });
});
