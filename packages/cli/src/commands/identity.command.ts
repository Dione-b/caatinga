import { randomBytes } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { execa } from "execa";
import * as tar from "tar";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function defaultStellarHome(): string {
  return path.join(os.homedir(), ".config", "stellar");
}

/**
 * Runs `fn` with a 0700 temp dir that is always removed afterwards. These archives
 * contain Stellar secret keys, so they must never outlive the command or be
 * readable by other users on the machine.
 */
async function withSecureTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "caatinga-stellar-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function secureArchivePath(dir: string): string {
  return path.join(dir, `${randomBytes(8).toString("hex")}.tar.gz`);
}

async function tarDirectory(sourceDir: string, outputFile: string): Promise<void> {
  // stdout carries the base64 archive, so tar must not write to it.
  await execa("tar", ["-czf", outputFile, "-C", sourceDir, "."], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
}

function validateArchiveEntry(entryPath: string, type: string, targetDir: string): void {
  if (type !== "File" && type !== "OldFile" && type !== "Directory") {
    throw new Error(
      `Refusing to import archive: entry "${entryPath}" is not a regular file or directory`
    );
  }
  if (entryPath.includes("\\") || path.posix.isAbsolute(entryPath)) {
    throw new Error(`Refusing to import archive: entry "${entryPath}" has an unsafe path`);
  }

  const resolvedTarget = path.resolve(targetDir);
  const resolvedEntry = path.resolve(resolvedTarget, entryPath);
  if (resolvedEntry !== resolvedTarget && !resolvedEntry.startsWith(resolvedTarget + path.sep)) {
    throw new Error(
      `Refusing to import archive: entry "${entryPath}" would extract outside ${resolvedTarget}`
    );
  }
}

async function ensureSafeDirectory(directory: string): Promise<void> {
  const resolved = path.resolve(directory);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error(`Refusing to import into non-directory or symbolic link: ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      await mkdir(current, { mode: 0o700 });
    }
  }
  await chmod(resolved, 0o700);
}

async function mergeStagedFiles(stagedDir: string, targetDir: string): Promise<void> {
  await ensureSafeDirectory(targetDir);
  for (const name of await readdir(stagedDir)) {
    const stagedPath = path.join(stagedDir, name);
    const targetPath = path.join(targetDir, name);
    const stagedInfo = await lstat(stagedPath);
    if (stagedInfo.isDirectory() && !stagedInfo.isSymbolicLink()) {
      await ensureSafeDirectory(targetPath);
      await mergeStagedFiles(stagedPath, targetPath);
      continue;
    }
    if (!stagedInfo.isFile()) {
      throw new Error(`Refusing to import archive: staged entry "${name}" is not a regular file`);
    }
    try {
      const targetInfo = await lstat(targetPath);
      if (!targetInfo.isFile() || targetInfo.isSymbolicLink()) {
        throw new Error(`Refusing to overwrite non-file or symbolic link: ${targetPath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await copyFile(stagedPath, targetPath);
    await chmod(targetPath, 0o600);
  }
  await chmod(targetDir, 0o700);
}

async function untarDirectory(
  archiveFile: string,
  targetDir: string,
  tempDir: string
): Promise<void> {
  const resolvedTarget = path.resolve(targetDir);
  await tar.t({
    file: archiveFile,
    onReadEntry(entry) {
      validateArchiveEntry(entry.path, entry.type, resolvedTarget);
    },
  });

  const stagedDir = path.join(tempDir, "extracted");
  await mkdir(stagedDir, { mode: 0o700 });
  await tar.x({
    file: archiveFile,
    cwd: stagedDir,
    preservePaths: false,
    preserveOwner: false,
    chmod: true,
    processUmask: 0o077,
    filter(entryPath, entry) {
      const type =
        "type" in entry
          ? entry.type
          : entry.isDirectory()
            ? "Directory"
            : entry.isFile()
              ? "File"
              : "Unsupported";
      validateArchiveEntry(entryPath, type, resolvedTarget);
      return true;
    },
  });
  await mergeStagedFiles(stagedDir, resolvedTarget);
}

export function registerIdentityCommand(program: Command): void {
  const identity = program
    .command("identity")
    .description("Export or import Stellar CLI identity config for CI");

  identity
    .command("export")
    .description("Export ~/.config/stellar (or STELLAR_HOME) as base64 tarball on stdout")
    .option("--path <path>", "Stellar config directory", defaultStellarHome())
    .action((options: { path?: string }) =>
      runCliAction(async () => {
        const source = path.resolve(options.path ?? defaultStellarHome());
        await withSecureTempDir(async (dir) => {
          const tmpArchive = secureArchivePath(dir);
          await tarDirectory(source, tmpArchive);
          const archive = await readFile(tmpArchive);
          process.stdout.write(archive.toString("base64"));
          // Status goes to stderr so `ctg identity export > id.b64` yields a clean archive.
          logger.successToStderr(`Exported ${source} (${archive.length} bytes, base64 on stdout)`);
        });
      })
    );

  identity
    .command("import")
    .description("Import base64 tarball file into Stellar config directory")
    .argument("<archive>", "Path to base64-encoded tarball file")
    .option("--path <path>", "Target Stellar config directory", defaultStellarHome())
    .action((archivePath: string, options: { path?: string }) =>
      runCliAction(async () => {
        const target = path.resolve(options.path ?? defaultStellarHome());
        const encoded = (await readFile(path.resolve(archivePath), "utf8")).trim();

        await withSecureTempDir(async (dir) => {
          const tmpArchive = secureArchivePath(dir);
          await writeFile(tmpArchive, Buffer.from(encoded, "base64"), { mode: 0o600 });
          await untarDirectory(tmpArchive, target, dir);
        });
        logger.success(`Imported identity config into ${target}`);
      })
    );
}
