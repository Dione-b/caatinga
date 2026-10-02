import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";

const execFileAsync = promisify(execFile);
const restoreScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../scripts/restore-stellar-ci-config.sh"
);

/**
 * CI builds `CAATINGA_CI_STELLAR_CONFIG_B64` and restores it with
 * scripts/restore-stellar-ci-config.sh. The output of `ctg identity export` must be
 * accepted as that secret (#278). Uses the real `tar` and `bash`.
 */
describe("identity export → CI restore script", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "caatinga-identity-ci-restore-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  async function exportIdentity(source: string): Promise<string> {
    let stdout = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await createProgram()
      .exitOverride()
      .parseAsync(["node", "caatinga", "identity", "export", "--path", source]);

    vi.restoreAllMocks();
    return stdout;
  }

  async function restore(secret: string, home: string) {
    return execFileAsync("bash", [restoreScript, home], {
      env: { ...process.env, CAATINGA_CI_STELLAR_CONFIG_B64: secret },
    });
  }

  it("should_restore_a_ctg_identity_export_archive_into_config_stellar", async () => {
    const source = path.join(root, "stellar");
    await mkdir(path.join(source, "identity"), { recursive: true });
    await writeFile(path.join(source, "identity", "deployer.toml"), 'secret_key = "S..."\n');
    await writeFile(path.join(source, "config.toml"), "[defaults]\n");

    const secret = await exportIdentity(source);
    const home = path.join(root, "home");
    await restore(secret, home);

    const identityFile = path.join(home, ".config", "stellar", "identity", "deployer.toml");
    expect(await readFile(identityFile, "utf8")).toBe('secret_key = "S..."\n');
    expect(await readFile(path.join(home, ".config", "stellar", "config.toml"), "utf8")).toBe(
      "[defaults]\n"
    );
    expect((await stat(identityFile)).mode & 0o777).toBe(0o600);
  });

  it("should_still_restore_a_dot_config_archive", async () => {
    const staging = path.join(root, "staging");
    await mkdir(path.join(staging, ".config", "stellar", "identity"), { recursive: true });
    await writeFile(
      path.join(staging, ".config", "stellar", "identity", "ci.toml"),
      'secret_key = "S..."\n'
    );
    const archive = path.join(root, "ci.tgz");
    await execFileAsync("tar", ["-C", staging, "-czf", archive, ".config"]);
    const secret = (await readFile(archive)).toString("base64");

    const home = path.join(root, "home");
    await restore(secret, home);

    expect(
      await readFile(path.join(home, ".config", "stellar", "identity", "ci.toml"), "utf8")
    ).toBe('secret_key = "S..."\n');
  });

  it("should_reject_an_archive_without_a_stellar_config_layout", async () => {
    const staging = path.join(root, "staging");
    await mkdir(staging, { recursive: true });
    await writeFile(path.join(staging, "unrelated.txt"), "nope\n");
    const archive = path.join(root, "bad.tgz");
    await execFileAsync("tar", ["-C", staging, "-czf", archive, "."]);
    const secret = (await readFile(archive)).toString("base64");

    await expect(restore(secret, path.join(root, "home"))).rejects.toMatchObject({
      stderr: expect.stringContaining("ctg identity export"),
    });
  });
});
