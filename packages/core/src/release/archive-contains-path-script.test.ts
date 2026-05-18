import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const helperPath = path.join(root, "scripts/lib/archive-contains-path.sh");
const consumerScriptPath = path.join(root, "scripts/consumer-isolation-test.sh");
const snapshotPackScriptPath = path.join(root, "scripts/ci-snapshot-pack.sh");

describe("archive path checks in release scripts", () => {
  it("centralizes archive member checks in a shared helper", async () => {
    await expect(readFile(helperPath, "utf8")).resolves.toContain("archive_contains_path()");
  });

  it("consumer isolation avoids pipefail-sensitive grep pipelines", async () => {
    const script = await readFile(consumerScriptPath, "utf8");
    expect(script).toContain('source "$ROOT_DIR/scripts/lib/archive-contains-path.sh"');
    expect(script).toContain('archive_contains_path "${_kcli[0]}"');
    expect(script).not.toContain('tar -tzf "${_kcli[0]}" | grep -q');
  });

  it("snapshot pack reuses the same helper for CLI template evidence", async () => {
    const script = await readFile(snapshotPackScriptPath, "utf8");
    expect(script).toContain('source "$ROOT_DIR/scripts/lib/archive-contains-path.sh"');
    expect(script).toContain('archive_contains_path "${cli_tarball[0]}"');
    expect(script).not.toContain('tar -tzf "${cli_tarball[0]}" | grep');
  });
});
