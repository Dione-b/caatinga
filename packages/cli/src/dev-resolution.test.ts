import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliRoot = fileURLToPath(new URL("..", import.meta.url));

describe("CLI dev module resolution", () => {
  it("should_not_map_caatinga_core_to_dist_dts_in_tsconfig_paths", () => {
    const tsconfig = JSON.parse(
      readFileSync(join(cliRoot, "tsconfig.json"), "utf8")
    ) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };

    const paths = tsconfig.compilerOptions?.paths ?? {};

    for (const [alias, targets] of Object.entries(paths)) {
      expect(alias).not.toMatch(/^@caatinga\/core/);
      for (const target of targets) {
        expect(target).not.toMatch(/\.d\.ts$/);
      }
    }
  });
});
