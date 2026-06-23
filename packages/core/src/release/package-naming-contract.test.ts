import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("package naming contract", () => {
  it("should_document_published_@caatinga/cli_in_readme", async () => {
    const readme = await readFile(path.join(root, "README.md"), "utf8");
    expect(readme).toMatch(/npm install -g @caatinga\/cli\b/);
    expect(readme).toMatch(/@caatinga\/cli/);
  });

  it("should_use_filter_name_matching_cli_package_json", async () => {
    const rootPkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    const cliPkg = JSON.parse(await readFile(path.join(root, "packages/cli/package.json"), "utf8"));
    const filter = rootPkg.scripts.dev.match(/--filter\s+(\S+)/)?.[1];
    expect(filter).toBe(cliPkg.name);
  });

  it("should_not_list_live_testnet_ci_as_alpha_non_goal", async () => {
    const alpha = await readFile(path.join(root, "docs/internal/release/v0.1.0-alpha.md"), "utf8");
    expect(alpha).not.toMatch(/- live testnet CI/);
    expect(alpha).toMatch(/testnet-smoke/);
  });
});
