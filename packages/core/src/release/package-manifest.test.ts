import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packages = ["core", "client"];
const repoRoot = join(__dirname, "../../../..");
const monorepoOnlyDependencyPattern = /(?:workspace|link|file):/;

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
      expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "README.md", "LICENSE"]));
      expect(JSON.stringify(packageJson)).not.toMatch(monorepoOnlyDependencyPattern);

      if (packageName === "client") {
        expect(packageJson.dependencies["@caatinga/core"]).toBe("^0.2.1");
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
    expect(packageJson.dependencies["@caatinga/core"]).toBe("^0.2.1");
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
