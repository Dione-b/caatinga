import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function defaultRepoRoot(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, "../../../..");
}

function getRepoSourceRootDirs(repoRoot: string): string[] {
  return [
    path.join(repoRoot, "packages/cli/src"),
    path.join(repoRoot, "packages/core/src"),
    path.join(repoRoot, "packages/client/src"),
  ];
}

function listSourceFilesRecursive(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      files.push(...listSourceFilesRecursive(entryPath));
      continue;
    }

    if (stat.isFile() && SOURCE_FILE_EXTENSIONS.has(path.extname(entryPath))) {
      files.push(entryPath);
    }
  }

  return files;
}

export function listRepoSourceFiles(repoRoot: string = defaultRepoRoot()): string[] {
  return getRepoSourceRootDirs(repoRoot).flatMap((root) => listSourceFilesRecursive(root));
}
