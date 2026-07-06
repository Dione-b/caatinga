import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TIER1_CLIENT_ROOT_EXPORTS } from "./tier1-client-exports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

function parseNamedExports(source: string): string[] {
  const names = new Set<string>();

  for (const match of source.matchAll(/export\s+type\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const trimmed = part.trim();
      if (trimmed) {
        names.add(trimmed);
      }
    }
  }

  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith("type ")) {
        continue;
      }
      const exportName = trimmed.split(/\s+as\s+/).pop()?.trim();
      if (exportName) {
        names.add(exportName);
      }
    }
  }

  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(/export\s+const\s+(\w+)/g)) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(/export\s+class\s+(\w+)/g)) {
    names.add(match[1]);
  }

  return [...names].sort();
}

describe("public API export manifest", () => {
  it("should_export_all_tier1_client_root_symbols", () => {
    const clientIndexPath = path.join(repoRoot, "packages/client/src/index.ts");
    const source = readFileSync(clientIndexPath, "utf8");
    const exported = parseNamedExports(source);
    const missing = TIER1_CLIENT_ROOT_EXPORTS.filter((name) => !exported.includes(name));

    expect(missing, `Missing Tier 1 client exports: ${missing.join(", ")}`).toEqual([]);
  });

  it("should_not_add_tier1_client_exports_without_manifest_update", () => {
    const clientIndexPath = path.join(repoRoot, "packages/client/src/index.ts");
    const source = readFileSync(clientIndexPath, "utf8");
    const exported = parseNamedExports(source);
    const extra = exported.filter(
      (name) => !(TIER1_CLIENT_ROOT_EXPORTS as readonly string[]).includes(name)
    );

    expect(
      extra,
      `New client root exports require docs/public-api.md update: ${extra.join(", ")}`
    ).toEqual([]);
  });

  it("should_document_public_api_manifest", () => {
    const manifestPath = path.join(repoRoot, "docs/public-api.md");
    const manifest = readFileSync(manifestPath, "utf8");

    expect(manifest).toContain("Tier 1 — Supported v1");
    expect(manifest).toContain("Tier 2 — Published but advanced");
    expect(manifest).toContain("Tier 3 — Internal");
  });
});
