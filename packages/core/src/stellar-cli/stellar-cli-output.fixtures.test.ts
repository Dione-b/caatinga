import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");

async function fixture(relativePath: string): Promise<string> {
  return readFile(path.join(fixturesDir, relativePath), "utf8");
}

describe("stellar CLI output fixtures", () => {
  it("should_keep_v26_invoke_success_fixture", async () => {
    const output = await fixture("v26.0.0/invoke-success.txt");

    expect(output.trim().length).toBeGreaterThan(0);
  });

  it("should_keep_v26_bindings_success_fixture", async () => {
    const output = await fixture("v26.0.0/bindings-success.txt");

    expect(output).toMatch(/bindings/i);
  });

  it("should_keep_v27_invoke_success_fixture", async () => {
    const output = await fixture("v27.0.0/invoke-success.txt");

    expect(output.trim().length).toBeGreaterThan(0);
  });

  it("should_keep_v27_bindings_success_fixture", async () => {
    const output = await fixture("v27.0.0/bindings-success.txt");

    expect(output).toMatch(/bindings/i);
  });
});
