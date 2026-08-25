import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import semver from "semver";

// Backs the Buffer polyfill that every generated binding imports. Pinned to the
// same major the templates ship so behaviour matches across init and adoption.
const BUFFER_DEPENDENCY_RANGE = "^6.0.3";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export type EnsureBufferDependencyResult = {
  packageJsonPath: string;
  added: boolean;
};

/** Nearest package.json at or above `startDir`, not walking past `stopDir`. */
async function findNearestPackageJson(
  startDir: string,
  stopDir: string
): Promise<string | undefined> {
  let dir = path.resolve(startDir);
  const stop = path.resolve(stopDir);

  while (true) {
    const candidate = path.join(dir, "package.json");
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      // not here — keep walking up
    }

    if (dir === stop) {
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return undefined;
}

/**
 * Ensure the frontend app declares `buffer` as a direct dependency.
 *
 * Generated bindings import `buffer` to polyfill the `Buffer` global. Under
 * pnpm's strict layout the `buffer` that ships transitively with
 * @stellar/stellar-sdk is not hoisted, so a bare `import "buffer"` from app code
 * fails to resolve. Declaring it directly keeps the polyfill working on every
 * package manager (npm, pnpm, yarn, bun) without the user touching anything.
 *
 * Best-effort: returns `undefined` if no frontend package.json can be located or
 * read. When it adds the dependency the caller should tell the user to reinstall.
 */
export async function ensureBufferDependency(
  cwd: string,
  bindingsOutput: string
): Promise<EnsureBufferDependencyResult | undefined> {
  const startDir = path.dirname(path.resolve(cwd, bindingsOutput));
  const packageJsonPath = await findNearestPackageJson(startDir, path.resolve(cwd));
  if (!packageJsonPath) {
    return undefined;
  }

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;
  } catch {
    return undefined;
  }

  const existing = pkg.dependencies?.buffer ?? pkg.devDependencies?.buffer;
  if (existing) {
    // #98: presence alone isn't enough — the templates pin `buffer` to a major
    // (^6). If the declared range already resolves within the supported range,
    // leave it; otherwise pin it, so a stale `buffer: "^1.0.0"` gets corrected
    // instead of silently kept.
    const minVersion = semver.minVersion(existing);
    if (minVersion && semver.satisfies(minVersion, BUFFER_DEPENDENCY_RANGE)) {
      return { packageJsonPath, added: false };
    }

    // Out of range (or unparseable) — update it in the section it already lives.
    if (pkg.dependencies?.buffer) {
      pkg.dependencies.buffer = BUFFER_DEPENDENCY_RANGE;
    } else {
      (pkg.devDependencies as Record<string, string>).buffer = BUFFER_DEPENDENCY_RANGE;
    }
    await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    return { packageJsonPath, added: true };
  }

  pkg.dependencies = { ...(pkg.dependencies ?? {}), buffer: BUFFER_DEPENDENCY_RANGE };
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  return { packageJsonPath, added: true };
}
