import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { execa } from "execa";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function defaultStellarHome(): string {
  return path.join(os.homedir(), ".config", "stellar");
}

async function tarDirectory(sourceDir: string, outputFile: string): Promise<void> {
  await execa("tar", ["-czf", outputFile, "-C", sourceDir, "."], { stdio: "inherit" });
}

async function untarDirectory(archiveFile: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
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
        const tmpArchive = path.join(os.tmpdir(), `caatinga-stellar-${Date.now()}.tar.gz`);
        await tarDirectory(source, tmpArchive);
        const archive = await readFile(tmpArchive);
        process.stdout.write(archive.toString("base64"));
        logger.info("");
        logger.success(`Exported ${source} (${archive.length} bytes, base64 above)`);
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

        const tmpArchive = path.join(os.tmpdir(), `caatinga-stellar-import-${Date.now()}.tar.gz`);
        await writeFile(tmpArchive, Buffer.from(encoded, "base64"));
        await untarDirectory(tmpArchive, target);
        logger.success(`Imported identity config into ${target}`);
      })
    );
}
