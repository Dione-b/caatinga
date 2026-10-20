import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rmdir,
  rm,
  unlink,
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

async function ensureSafeDirectory(directory: string): Promise<string> {
  const resolved = path.resolve(directory);
  await mkdir(resolved, { recursive: true, mode: 0o700 });
  const info = await lstat(resolved);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Refusing to import into non-directory or symbolic link: ${resolved}`);
  }
  // Resolve permitted symlinked ancestors (for example macOS /var -> /private/var)
  // once, then perform all child operations beneath the physical target directory.
  return realpath(resolved);
}

interface StagedFile {
  relativePath: string;
  stagedPath: string;
}

async function listStagedFiles(
  stagedDir: string,
  relativeDir = ""
): Promise<{ directories: string[]; files: StagedFile[] }> {
  const directories: string[] = [];
  const files: StagedFile[] = [];
  for (const name of await readdir(path.join(stagedDir, relativeDir))) {
    const relativePath = path.join(relativeDir, name);
    const stagedPath = path.join(stagedDir, relativePath);
    const info = await lstat(stagedPath);
    if (info.isDirectory() && !info.isSymbolicLink()) {
      directories.push(relativePath);
      const nested = await listStagedFiles(stagedDir, relativePath);
      directories.push(...nested.directories);
      files.push(...nested.files);
    } else if (info.isFile() && !info.isSymbolicLink()) {
      files.push({ relativePath, stagedPath });
    } else {
      throw new Error(`Refusing to import: staged entry "${relativePath}" is not a regular file`);
    }
  }
  return { directories, files };
}

async function targetEntryType(targetPath: string): Promise<"directory" | "file" | "missing"> {
  try {
    const info = await lstat(targetPath);
    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite symbolic link: ${targetPath}`);
    }
    if (info.isDirectory()) {
      return "directory";
    }
    if (info.isFile()) {
      return "file";
    }
    throw new Error(`Refusing to overwrite non-file: ${targetPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
}

interface StagedReplacement extends StagedFile {
  targetPath: string;
  temporaryPath: string;
  backupPath?: string;
  installed: boolean;
}

async function removeIfPresent(filePath: string): Promise<void> {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

async function mergeStagedFiles(stagedDir: string, targetDir: string): Promise<void> {
  const resolvedTarget = await ensureSafeDirectory(targetDir);
  const staged = await listStagedFiles(stagedDir);
  const directorySet = new Set(staged.directories);
  const fileSet = new Set(staged.files.map(({ relativePath }) => relativePath));
  for (const directory of directorySet) {
    if (fileSet.has(directory)) {
      throw new Error(
        'Refusing to import archive: path "' + directory + '" is both a file and a directory'
      );
    }
  }
  for (const file of fileSet) {
    for (let parent = path.dirname(file); parent !== "."; parent = path.dirname(parent)) {
      if (fileSet.has(parent)) {
        throw new Error(
          `Refusing to import archive: file and directory paths overlap at "${parent}"`
        );
      }
      directorySet.add(parent);
    }
  }

  // Check every destination before making any changes so ordinary conflicts cannot
  // leave a partially imported identity behind.
  const missingDirectories: string[] = [];
  for (const relativePath of [...directorySet].sort(
    (a, b) => a.split(path.sep).length - b.split(path.sep).length
  )) {
    const destination = path.join(resolvedTarget, relativePath);
    const type = await targetEntryType(destination);
    if (type === "file") {
      throw new Error(`Refusing to create directory over file: ${destination}`);
    }
    if (type === "missing") {
      missingDirectories.push(destination);
    }
  }
  for (const { relativePath } of staged.files) {
    const destination = path.join(resolvedTarget, relativePath);
    if ((await targetEntryType(destination)) === "directory") {
      throw new Error(`Refusing to overwrite directory with file: ${destination}`);
    }
  }

  const createdDirectories: string[] = [];
  const replacements: StagedReplacement[] = [];
  try {
    for (const directory of missingDirectories) {
      await mkdir(directory, { mode: 0o700 });
      createdDirectories.push(directory);
    }

    for (const file of staged.files) {
      const targetPath = path.join(resolvedTarget, file.relativePath);
      const temporaryPath = path.join(
        path.dirname(targetPath),
        `.caatinga-identity-${randomBytes(8).toString("hex")}.tmp`
      );
      const replacement = { ...file, targetPath, temporaryPath, installed: false };
      replacements.push(replacement);
      await copyFile(file.stagedPath, temporaryPath, fsConstants.COPYFILE_EXCL);
      await chmod(temporaryPath, 0o600);
    }

    for (const replacement of replacements) {
      // rename replaces a final symlink itself rather than following it. Keeping the
      // temp file beside the destination also makes the install atomic on that volume.
      if ((await targetEntryType(replacement.targetPath)) === "file") {
        replacement.backupPath = path.join(
          path.dirname(replacement.targetPath),
          `.caatinga-identity-${randomBytes(8).toString("hex")}.bak`
        );
        await rename(replacement.targetPath, replacement.backupPath);
      }
      await rename(replacement.temporaryPath, replacement.targetPath);
      replacement.installed = true;
    }
  } catch (error) {
    for (const replacement of [...replacements].reverse()) {
      if (replacement.installed) {
        await removeIfPresent(replacement.targetPath).catch(() => undefined);
      }
      if (replacement.backupPath) {
        await rename(replacement.backupPath, replacement.targetPath).catch(() => undefined);
      }
      await removeIfPresent(replacement.temporaryPath).catch(() => undefined);
    }
    for (const directory of [...createdDirectories].reverse()) {
      await rmdir(directory).catch(() => undefined);
    }
    throw error;
  }

  for (const replacement of replacements) {
    if (replacement.backupPath) {
      await removeIfPresent(replacement.backupPath);
    }
  }
}

async function untarDirectory(
  archiveFile: string,
  targetDir: string,
  tempDir: string
): Promise<void> {
  const resolvedTarget = path.resolve(targetDir);
  let validationError: Error | undefined;
  await tar.t({
    file: archiveFile,
    onReadEntry(entry) {
      if (validationError) {
        return;
      }
      try {
        validateArchiveEntry(entry.path, entry.type, resolvedTarget);
      } catch (error) {
        validationError = error as Error;
      }
    },
  });
  if (validationError) {
    throw validationError;
  }

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
      try {
        validateArchiveEntry(entryPath, type, resolvedTarget);
      } catch (error) {
        validationError = error as Error;
        return false;
      }
      return true;
    },
  });
  if (validationError) {
    throw validationError;
  }
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
