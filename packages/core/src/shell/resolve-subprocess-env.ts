import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function uniquePaths(entries: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const entry of entries) {
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    ordered.push(entry);
  }

  return ordered;
}

function hasExecutable(binDir: string, name: string): boolean {
  return existsSync(path.join(binDir, name));
}

function toolchainBinDirs(home: string, env: NodeJS.ProcessEnv): string[] {
  const candidates = [
    path.join(home, ".cargo", "bin"),
    env.CARGO_HOME ? path.join(env.CARGO_HOME, "bin") : undefined,
  ];

  return candidates.filter((entry): entry is string => Boolean(entry && existsSync(entry)));
}

export function buildToolchainPrepend(
  existingPath: string[],
  toolchainBins: string[],
  executableExists: (binDir: string, name: string) => boolean = hasExecutable
): string[] {
  const prepend: string[] = [];

  for (const binDir of toolchainBins) {
    const externalStellarDir = existingPath.find(
      (entry) => entry !== binDir && executableExists(entry, "stellar")
    );

    prepend.push(binDir);

    if (externalStellarDir && executableExists(binDir, "stellar")) {
      prepend.push(externalStellarDir);
    }
  }

  return prepend;
}

export function resolveSubprocessEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  const home = env.HOME ?? os.homedir();
  const existingPath = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const toolchainBins = toolchainBinDirs(home, env);
  const prepend = buildToolchainPrepend(existingPath, toolchainBins);

  env.PATH = uniquePaths([...prepend, ...existingPath]).join(path.delimiter);
  return env;
}

export function isCargoBinMissingFromPath(baseEnv: NodeJS.ProcessEnv = process.env): boolean {
  const home = baseEnv.HOME ?? os.homedir();
  const cargoBin = path.join(home, ".cargo", "bin", "cargo");
  if (!existsSync(cargoBin)) {
    return false;
  }

  const pathEntries = (baseEnv.PATH ?? "").split(path.delimiter);
  return !pathEntries.some((entry) => entry === path.join(home, ".cargo", "bin"));
}
