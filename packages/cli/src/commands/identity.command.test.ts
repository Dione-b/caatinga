import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import * as tar from "tar";
import { createProgram } from "../program.js";
import { defaultStellarHome } from "./identity.command.js";

vi.mock("execa", () => ({ execa: vi.fn() }));
vi.mock("tar", () => ({ t: vi.fn(), x: vi.fn() }));

const execaMock = vi.mocked(execa);
const tarMock = vi.mocked(tar);

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
    tarMock.t.mockReset();
    tarMock.x.mockReset();
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

  async function runImport(archivePath: string, targetDir: string): Promise<void> {
    await createProgram()
      .exitOverride()
      .parseAsync(["node", "caatinga", "identity", "import", archivePath, "--path", targetDir]);
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

  it("should_reject_symlink_members_before_extracting", async () => {
    const archive = path.join(tmpRoot, "identity.txt");
    const target = path.join(tmpRoot, "stellar-home");
    await writeFile(archive, Buffer.from("not-a-real-archive").toString("base64"));

    tarMock.t.mockImplementation((async (options: unknown) => {
      const onReadEntry = (options as { onReadEntry?: (entry: unknown) => void }).onReadEntry;
      onReadEntry?.({ path: "link", type: "SymbolicLink" });
    }) as unknown as typeof tar.t);

    const exitCodeBefore = process.exitCode;
    await runImport(archive, target);

    expect(tarMock.x).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    process.exitCode = exitCodeBefore;
  });

  it("should_extract_with_portable_tar_options_and_secure_modes", async () => {
    const archive = path.join(tmpRoot, "identity.txt");
    const target = path.join(tmpRoot, "stellar-home");
    await writeFile(archive, Buffer.from("not-a-real-archive").toString("base64"));

    tarMock.t.mockImplementation((async (options: unknown) => {
      const onReadEntry = (options as { onReadEntry?: (entry: unknown) => void }).onReadEntry;
      onReadEntry?.({ path: "identity", type: "File" });
    }) as unknown as typeof tar.t);

    await runImport(archive, target);

    expect(tarMock.x).toHaveBeenCalledWith(
      expect.objectContaining({
        preservePaths: false,
        preserveOwner: false,
        chmod: true,
        processUmask: 0o077,
      })
    );
  });
});

describe("defaultStellarHome env precedence (#233)", () => {
  const keys = ["STELLAR_CONFIG_HOME", "STELLAR_HOME", "XDG_CONFIG_HOME"] as const;
  let saved: Record<(typeof keys)[number], string | undefined>;

  beforeEach(() => {
    saved = {
      STELLAR_CONFIG_HOME: process.env.STELLAR_CONFIG_HOME,
      STELLAR_HOME: process.env.STELLAR_HOME,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    };
    for (const key of keys) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = saved[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    execaMock.mockReset();
    vi.restoreAllMocks();
  });

  it("should_fall_back_to_homedir_when_no_env_is_set", () => {
    expect(defaultStellarHome()).toBe(path.join(os.homedir(), ".config", "stellar"));
  });

  it("should_honor_STELLAR_HOME", () => {
    process.env.STELLAR_HOME = "/secure/mainnet-keys";
    expect(defaultStellarHome()).toBe("/secure/mainnet-keys");
  });

  it("should_honor_STELLAR_CONFIG_HOME", () => {
    process.env.STELLAR_CONFIG_HOME = "/secure/stellar-config";
    expect(defaultStellarHome()).toBe("/secure/stellar-config");
  });

  it("should_prefer_STELLAR_CONFIG_HOME_over_STELLAR_HOME", () => {
    process.env.STELLAR_CONFIG_HOME = "/secure/config-home";
    process.env.STELLAR_HOME = "/secure/stellar-home";
    expect(defaultStellarHome()).toBe("/secure/config-home");
  });

  it("should_honor_XDG_CONFIG_HOME", () => {
    process.env.XDG_CONFIG_HOME = "/custom/xdg";
    expect(defaultStellarHome()).toBe(path.join("/custom/xdg", "stellar"));
  });

  it("should_prefer_STELLAR_HOME_over_XDG_CONFIG_HOME", () => {
    process.env.STELLAR_HOME = "/secure/stellar-home";
    process.env.XDG_CONFIG_HOME = "/custom/xdg";
    expect(defaultStellarHome()).toBe("/secure/stellar-home");
  });

  it("should_ignore_empty_and_whitespace_env_values", () => {
    process.env.STELLAR_CONFIG_HOME = "   ";
    process.env.STELLAR_HOME = "";
    process.env.XDG_CONFIG_HOME = "  ";
    expect(defaultStellarHome()).toBe(path.join(os.homedir(), ".config", "stellar"));
  });

  it("should_export_from_STELLAR_HOME_when_no_path_flag_is_given", async () => {
    const stellarHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-stellar-home-"));
    process.env.STELLAR_HOME = stellarHome;
    // Commander captures the default at registration, which now reads the env above.
    const seenSources: string[] = [];
    execaMock.mockImplementation((async (_file: string, args: readonly string[]) => {
      // tar -czf <archive> -C <source> .
      seenSources.push(args[3] as string);
      await writeFile(args[1] as string, "not-a-real-tarball", "utf8");
      return { stdout: "", stderr: "", all: "" };
    }) as unknown as typeof execa);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await createProgram().exitOverride().parseAsync(["node", "caatinga", "identity", "export"]);

      expect(seenSources).toHaveLength(1);
      expect(seenSources[0]).toBe(stellarHome);
    } finally {
      await rm(stellarHome, { recursive: true, force: true });
    }
  });
});
