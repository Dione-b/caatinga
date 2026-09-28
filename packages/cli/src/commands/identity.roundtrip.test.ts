import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";

/**
 * `ctg identity export > id.b64` must produce a file that `ctg identity import id.b64`
 * restores byte-for-byte. Status lines on stdout used to corrupt the archive (#227).
 * Uses the real `tar`, unlike identity.command.test.ts.
 */
describe("identity export/import round trip", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "caatinga-identity-roundtrip-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  async function run(args: string[]): Promise<void> {
    await createProgram()
      .exitOverride()
      .parseAsync(["node", "caatinga", "identity", ...args]);
  }

  it("should_write_only_the_base64_archive_to_stdout_and_restore_it_on_import", async () => {
    const source = path.join(root, "source");
    await mkdir(path.join(source, "identity"), { recursive: true });
    await writeFile(path.join(source, "identity", "deployer.toml"), 'secret_key = "S..."\n');

    let stdout = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await run(["export", "--path", source]);

    expect(log).not.toHaveBeenCalled();
    expect(stdout).toMatch(/^[A-Za-z0-9+/]+=*$/);

    const archiveFile = path.join(root, "id.b64");
    await writeFile(archiveFile, stdout);
    const target = path.join(root, "target");
    await run(["import", archiveFile, "--path", target]);

    expect(await readFile(path.join(target, "identity", "deployer.toml"), "utf8")).toBe(
      'secret_key = "S..."\n'
    );
  });
});
