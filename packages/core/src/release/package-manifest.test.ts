import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packages = ["core", "client"];
const repoRoot = join(__dirname, "../../../..");
const monorepoOnlyDependencyPattern = /(?:workspace|link|file):/;
const coreVersion = JSON.parse(
  readFileSync(join(repoRoot, "packages/core/package.json"), "utf8")
).version as string;
const coreVersionRange = `^${coreVersion}`;

describe("publish package manifests", () => {
  for (const packageName of packages) {
    it(`${packageName} has publish-safe exports`, () => {
      const packageJson = JSON.parse(
        readFileSync(join(repoRoot, `packages/${packageName}/package.json`), "utf8")
      );

      expect(packageJson.type).toBe("module");
      expect(packageJson.main).toBe("./dist/index.cjs");
      expect(packageJson.module).toBe("./dist/index.js");
      expect(packageJson.types).toBe("./dist/index.d.ts");
      expect(packageJson.exports["."]).toEqual({
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
        require: "./dist/index.cjs"
      });
      if (packageName === "core") {
        expect(packageJson.exports["./browser"]).toEqual({
          types: "./dist/browser.d.ts",
          import: "./dist/browser.js",
          require: "./dist/browser.cjs"
        });
        expect(packageJson.scripts.build).toBe("tsup");
        expect(
          readFileSync(join(repoRoot, "packages/core/tsup.config.ts"), "utf8")
        ).toContain("src/browser.ts");
      }
      expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "README.md", "LICENSE"]));
      expect(JSON.stringify(packageJson)).not.toMatch(monorepoOnlyDependencyPattern);

      if (packageName === "client") {
        expect(packageJson.dependencies["@caatinga/core"]).toBe(coreVersionRange);
      }
    });
  }

  it("cli exposes caatinga bin", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "packages/cli/package.json"), "utf8"));
    expect(packageJson.bin).toEqual({ caatinga: "./dist/index.js" });
    expect(packageJson.main).toBe("./dist/index.js");
    expect(packageJson.module).toBe("./dist/index.js");
    expect(packageJson.types).toBe("./dist/index.d.ts");
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js"
      }
    });
    expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "templates", "README.md", "LICENSE"]));
    expect(packageJson.dependencies["@caatinga/core"]).toBe(coreVersionRange);
    expect(packageJson.scripts.build).toContain("tsup src/index.ts");
    expect(JSON.stringify(packageJson)).not.toMatch(monorepoOnlyDependencyPattern);
  });

  it("client exposes freighter subpath", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "packages/client/package.json"), "utf8")
    );
    expect(packageJson.exports["./freighter"]).toEqual({
      types: "./dist/freighter.d.ts",
      import: "./dist/freighter.js",
      require: "./dist/freighter.cjs"
    });
  });

  it("client exposes stellar-wallets-kit subpath", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "packages/client/package.json"), "utf8")
    );
    expect(packageJson.exports["./stellar-wallets-kit"]).toEqual({
      types: "./dist/stellar-wallets-kit.d.ts",
      import: "./dist/stellar-wallets-kit.js",
      require: "./dist/stellar-wallets-kit.cjs"
    });
    expect(packageJson.scripts.build).toContain("src/stellar-wallets-kit.ts");
    expect(packageJson.peerDependencies["@creit.tech/stellar-wallets-kit"]).toBe("^1.9.5");
    expect(packageJson.peerDependenciesMeta["@creit.tech/stellar-wallets-kit"]).toEqual({
      optional: true
    });
  });

  it("publish dry-run uses the pre-v1 next dist-tag", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["publish:dry-run"]).toContain("--tag next");
  });

  it("release matrix checks version alignment and pinned Stellar CLI before publish gates", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["ci:publish-matrix"]).toMatch(
      /^bash scripts\/check-version-alignment\.sh && bash scripts\/check-ci-stellar-pin\.sh && /
    );
  });
});
