import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

type PackageExports = Record<string, unknown>;

function readPackageExports(packageName: string): PackageExports {
  const pkgPath = path.join(repoRoot, "packages", packageName, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { exports: PackageExports };
  return pkg.exports;
}

describe("compatibility: package exports snapshot", () => {
  it("should_match_core_package_exports_snapshot", () => {
    expect(readPackageExports("core")).toMatchInlineSnapshot(`
      {
        ".": {
          "import": "./dist/index.js",
          "require": "./dist/index.cjs",
          "types": "./dist/index.d.ts",
        },
        "./browser": {
          "import": "./dist/browser.js",
          "require": "./dist/browser.cjs",
          "types": "./dist/browser.d.ts",
        },
        "./runtime/requirements": {
          "import": "./dist/runtime/requirements.js",
          "require": "./dist/runtime/requirements.cjs",
          "types": "./dist/runtime/requirements.d.ts",
        },
      }
    `);
  });

  it("should_match_client_package_exports_snapshot", () => {
    expect(readPackageExports("client")).toMatchInlineSnapshot(`
      {
        ".": {
          "import": "./dist/index.js",
          "require": "./dist/index.cjs",
          "types": "./dist/index.d.ts",
        },
        "./freighter": {
          "import": "./dist/freighter.js",
          "require": "./dist/freighter.cjs",
          "types": "./dist/freighter.d.ts",
        },
        "./react": {
          "import": "./dist/react.js",
          "require": "./dist/react.cjs",
          "types": "./dist/react.d.ts",
        },
        "./stellar-wallets-kit": {
          "import": "./dist/stellar-wallets-kit.js",
          "require": "./dist/stellar-wallets-kit.cjs",
          "types": "./dist/stellar-wallets-kit.d.ts",
        },
        "./vite": {
          "import": "./dist/vite.js",
          "require": "./dist/vite.cjs",
          "types": "./dist/vite.d.ts",
        },
      }
    `);
  });
});
