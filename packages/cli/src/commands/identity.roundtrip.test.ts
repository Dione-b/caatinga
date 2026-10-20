import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";

interface ArchiveEntry {
  name: string;
  type?: "file" | "directory" | "symlink" | "hardlink";
  content?: string;
  linkName?: string;
}

function octal(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, "0") + String.fromCharCode(0);
}

/** Build a tiny ustar archive so malicious headers can be tested without shell tar flags. */
function archive(entries: ArchiveEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, "utf8");
    header.write(octal(entry.type === "directory" ? 0o700 : 0o600, 8), 100, 8, "ascii");
    header.write(octal(0, 8), 108, 8, "ascii");
    header.write(octal(0, 8), 116, 8, "ascii");
    const data = Buffer.from(entry.content ?? "");
    header.write(
      octal(entry.type === "file" || entry.type === undefined ? data.length : 0, 12),
      124,
      12,
      "ascii"
    );
    header.write(octal(0, 12), 136, 12, "ascii");
    header.fill(0x20, 148, 156);
    const typeFlag = { file: "0", directory: "5", symlink: "2", hardlink: "1" }[
      entry.type ?? "file"
    ];
    header.write(typeFlag, 156, 1, "ascii");
    if (entry.linkName) {
      header.write(entry.linkName, 157, 100, "utf8");
    }
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(
      checksum.toString(8).padStart(6, "0") + String.fromCharCode(0, 0x20),
      148,
      8,
      "ascii"
    );
    blocks.push(header);
    if (data.length > 0) {
      blocks.push(data, Buffer.alloc((512 - (data.length % 512)) % 512));
    }
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

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

  async function importEntries(entries: ArchiveEntry[], target: string): Promise<void> {
    const archiveFile = path.join(root, "archive.b64");
    await writeFile(archiveFile, archive(entries).toString("base64"));
    await run(["import", archiveFile, "--path", target]);
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

  it.each([
    { name: "parent traversal", entries: [{ name: "../outside.txt", content: "outside" }] },
    { name: "absolute path", entries: [{ name: "/outside.txt", content: "outside" }] },
    {
      name: "symbolic link",
      entries: [{ name: "link", type: "symlink" as const, linkName: "outside.txt" }],
    },
    {
      name: "hard link",
      entries: [{ name: "link", type: "hardlink" as const, linkName: "identity/key" }],
    },
  ])("should_reject_real_archives_with_$name", async ({ entries }) => {
    const target = path.join(root, "target");
    const exitCodeBefore = process.exitCode;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await importEntries(entries, target);

    expect(process.exitCode).toBe(1);
    await expect(readFile(path.join(root, "outside.txt"))).rejects.toThrow();
    await expect(readFile(path.join(target, "link"))).rejects.toThrow();
    process.exitCode = exitCodeBefore;
  });

  it("should_accept_the_dot_directory_entry_emitted_by_tar_c_dot", async () => {
    const target = path.join(root, "target");
    await importEntries(
      [
        { name: ".", type: "directory" },
        { name: "identity/", type: "directory" },
        { name: "identity/deployer.toml", content: 'secret_key = "S..."\n' },
      ],
      target
    );

    expect(await readFile(path.join(target, "identity", "deployer.toml"), "utf8")).toBe(
      'secret_key = "S..."\n'
    );
  });

  it("should_preflight_all_targets_before_replacing_any_existing_file", async () => {
    const target = path.join(root, "target");
    const identityDir = path.join(target, "identity");
    await mkdir(path.join(identityDir, "conflict"), { recursive: true });
    await writeFile(path.join(identityDir, "existing.toml"), "keep this value");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitCodeBefore = process.exitCode;

    await importEntries(
      [
        { name: "identity/existing.toml", content: "replace this value" },
        { name: "identity/conflict", content: "cannot replace a directory" },
      ],
      target
    );

    expect(process.exitCode).toBe(1);
    expect(await readFile(path.join(identityDir, "existing.toml"), "utf8")).toBe("keep this value");
    expect((await stat(path.join(identityDir, "conflict"))).isDirectory()).toBe(true);
    process.exitCode = exitCodeBefore;
  });

  it("should_allow_a_symlinked_target_ancestor_without_changing_existing_directory_modes", async () => {
    const actualParent = path.join(root, "actual");
    const linkedParent = path.join(root, "linked");
    await mkdir(actualParent, { mode: 0o755 });
    const actualTarget = path.join(actualParent, "stellar");
    await mkdir(actualTarget, { mode: 0o755 });
    await symlink(actualParent, linkedParent);
    const target = path.join(linkedParent, "stellar");

    await importEntries([{ name: "identity/key", content: "secret" }], target);

    expect(await readFile(path.join(actualTarget, "identity", "key"), "utf8")).toBe("secret");
    expect((await stat(actualParent)).mode & 0o777).toBe(0o755);
    expect((await stat(actualTarget)).mode & 0o777).toBe(0o755);
    expect((await stat(path.join(actualTarget, "identity"))).mode & 0o777).toBe(0o700);
  });
});
