import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import { createProgram } from "../program.js";

vi.mock("execa", () => ({ execa: vi.fn() }));

const execaMock = vi.mocked(execa);

/**
 * `identity export`/`import` archive `~/.config/stellar`, which holds Stellar secret keys.
 * An earlier version wrote that archive to `os.tmpdir()` under a predictable
 * `caatinga-stellar-<Date.now()>.tar.gz` name with default permissions and never deleted
 * it, leaving key material readable by other users of the machine or CI runner.
 *
 * These tests pin the guarantees that replaced it: a 0700 directory, an unpredictable
 * name, and removal even when the command fails.
 */
describe("identity command temp archive handling", () => {
  let tmpRoot: string;
  let originalTmpDir: string | undefined;
  let restoreStdout: () => void;

  /** Paths observed while the command was still running. */
  let observed: Array<{ archive: string; dirMode: number }>;

  beforeEach(async () => {
    // os.tmpdir() reads TMPDIR on each call, so this scopes the command to a directory
    // we can assert is empty afterwards.
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "caatinga-identity-test-"));
    originalTmpDir = process.env.TMPDIR;
    process.env.TMPDIR = tmpRoot;

    observed = [];
    execaMock.mockReset();
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    restoreStdout = () => stdoutSpy.mockRestore();
  });

  afterEach(async () => {
    restoreStdout();
    if (originalTmpDir === undefined) {
      delete process.env.TMPDIR;
    } else {
      process.env.TMPDIR = originalTmpDir;
    }
    await rm(tmpRoot, { recursive: true, force: true });
  });

  /** Stands in for `tar`, recording what it was handed and creating the archive file. */
  function mockTarWritingArchive(): void {
    execaMock.mockImplementation((async (_file: string, args: readonly string[]) => {
      const archive = args[1] as string;
      const dir = path.dirname(archive);
      observed.push({ archive, dirMode: (await stat(dir)).mode & 0o777 });
      await writeFile(archive, "not-a-real-tarball", "utf8");
      return { stdout: "", stderr: "", all: "" };
    }) as unknown as typeof execa);
  }

  async function runExport(sourceDir: string): Promise<void> {
    await createProgram()
      .exitOverride()
      .parseAsync(["node", "caatinga", "identity", "export", "--path", sourceDir]);
  }

  it("should_write_the_archive_into_a_0700_directory_under_an_unpredictable_name", async () => {
    mockTarWritingArchive();
    const source = await mkdtemp(path.join(tmpRoot, "stellar-home-"));

    await runExport(source);

    expect(observed).toHaveLength(1);
    const { archive, dirMode } = observed[0] as { archive: string; dirMode: number };

    expect(dirMode).toBe(0o700);
    // Random hex, not the old `caatinga-stellar-<Date.now()>.tar.gz`.
    expect(path.basename(archive)).toMatch(/^[0-9a-f]{16}\.tar\.gz$/);
    expect(path.basename(archive)).not.toMatch(/\d{13}/);
  });

  it("should_leave_no_archive_behind_after_a_successful_export", async () => {
    mockTarWritingArchive();
    const source = await mkdtemp(path.join(tmpRoot, "stellar-home-"));

    await runExport(source);

    const { archive } = observed[0] as { archive: string };
    await expect(stat(archive)).rejects.toThrow();
    await expect(stat(path.dirname(archive))).rejects.toThrow();
  });

  it("should_remove_the_archive_directory_even_when_tar_fails", async () => {
    let archiveDir: string | undefined;
    execaMock.mockImplementation((async (_file: string, args: readonly string[]) => {
      archiveDir = path.dirname(args[1] as string);
      // Create the archive first, so the assertion proves cleanup rather than absence.
      await writeFile(args[1] as string, "partial", "utf8");
      throw new Error("tar: exploded");
    }) as unknown as typeof execa);

    const source = await mkdtemp(path.join(tmpRoot, "stellar-home-"));
    const exitCodeBefore = process.exitCode;

    await runExport(source);

    expect(archiveDir).toBeDefined();
    await expect(stat(archiveDir as string)).rejects.toThrow();
    process.exitCode = exitCodeBefore;
  });

  it("should_not_leak_any_file_into_the_temp_directory_it_was_given", async () => {
    mockTarWritingArchive();
    const source = await mkdtemp(path.join(tmpRoot, "stellar-home-"));

    await runExport(source);

    // Only the source directory this test created may remain — no archive, no temp dir.
    const remaining = await readdir(tmpRoot);
    expect(remaining).toEqual([path.basename(source)]);
  });
});
