#!/usr/bin/env node
// CI does not compile the templates (they are scaffolded into user projects that
// run their own tsc), so a bad relative import in a template can ship unnoticed.
// #244: zk-starter's placeholder bindings imported `../../network.js` from
// `src/bindings/verifier/src/`, which resolves to `src/bindings/network.ts`
// (missing) instead of `src/network.ts` — every scaffolded zk-starter project
// failed `tsc --noEmit` with TS2307.
//
// This check resolves every relative import in `packages/templates/*/src` the way
// TypeScript's ESM resolution does (`.js` -> `.ts` / `.tsx` / `index.ts`) and
// fails when the target file is missing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, "packages", "templates");
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

const IMPORT_PATTERNS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*["']([^"']+)["']/g,
];

function collectSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path.join(dir, entry.name)));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function resolveRelativeSpecifier(specifier, importerDir) {
  const base = path.resolve(importerDir, specifier);
  const candidates = [base];
  if (/\.(js|mjs|cjs)$/.test(base)) {
    const withoutExtension = base.replace(/\.(js|mjs|cjs)$/, "");
    candidates.push(
      `${withoutExtension}.ts`,
      `${withoutExtension}.tsx`,
      path.join(withoutExtension, "index.ts"),
      path.join(withoutExtension, "index.tsx")
    );
  } else {
    candidates.push(
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx")
    );
  }
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

const failures = [];

if (!existsSync(TEMPLATES_DIR)) {
  failures.push(`templates directory not found: ${path.relative(ROOT, TEMPLATES_DIR)}`);
} else {
  for (const template of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!template.isDirectory()) continue;

    const srcDir = path.join(TEMPLATES_DIR, template.name, "src");
    if (!existsSync(srcDir)) continue;

    for (const file of collectSourceFiles(srcDir)) {
      const content = readFileSync(file, "utf8");
      const relativeFile = path.join(
        "packages/templates",
        template.name,
        path.relative(path.join(TEMPLATES_DIR, template.name), file)
      );

      for (const pattern of IMPORT_PATTERNS) {
        for (const match of content.matchAll(pattern)) {
          const specifier = match[1];
          if (!specifier.startsWith(".")) continue;
          if (resolveRelativeSpecifier(specifier, path.dirname(file))) continue;

          const line = content.slice(0, match.index).split(/\r?\n/).length;
          failures.push(`${relativeFile}:${line}: "${specifier}" does not resolve`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`✗ ${failure}`);
  }
  console.error(
    "\nTemplate relative imports must resolve from the template source tree — scaffolded projects run tsc, CI does not."
  );
  process.exit(1);
}

console.log("✓ template relative imports resolve");
