import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { execa } from "execa";
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
  await execa("tar", ["-czf", outputFile, "-C", sourceDir, "."], { stdio: "inherit" });
}

async function assertNoPathTraversal(archiveFile: string, targetDir: string): Promise<void> {
  const { stdout } = await execa("tar", ["-tzf", archiveFile]);
  const resolvedTarget = path.resolve(targetDir);

  for (const rawEntry of stdout.split("\n")) {
    const entry = rawEntry.trim();
    if (!entry) {
      continue;
    }

    const resolvedEntry = path.resolve(resolvedTarget, entry);
    if (
      resolvedEntry !== resolvedTarget &&
      !resolvedEntry.startsWith(resolvedTarget + path.sep)
    ) {
      throw new Error(
        `Refusing to import archive: entry "${entry}" would extract outside ${resolvedTarget}`
      );
    }
  }
}

async function untarDirectory(archiveFile: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true, mode: 0o700 });
  await assertNoPathTraversal(archiveFile, targetDir);
  await execa("tar", ["-xzf", archiveFile, "-C", targetDir], { stdio: "inherit" });
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
          logger.info("");
          logger.success(`Exported ${source} (${archive.length} bytes, base64 above)`);
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
          await untarDirectory(tmpArchive, target);
        });
        logger.success(`Imported identity config into ${target}`);
      })
    );
}
