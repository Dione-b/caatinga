import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const TEMPLATES: { name: string; contracts: string[] }[] = [
  {
    name: "react-vite-counter",
    contracts: ["counter"],
  },
  {
    name: "zk-starter",
    contracts: ["verifier"],
  },
];

describe("template npm scripts", () => {
  for (const template of TEMPLATES) {
    test(`${template.name} has a test script that runs cargo test`, () => {
      const pkgPath = resolve(__dirname, "../../../templates", template.name, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.test).toContain("cargo test");

      for (const contract of template.contracts) {
        expect(pkg.scripts.test).toContain(`--manifest-path contracts/${contract}/Cargo.toml`);
      }
    });
  }
});
