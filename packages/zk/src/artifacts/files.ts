import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat, writeFile } from "node:fs/promises";

/** Streaming sha256 of a file's raw bytes (zkeys can be hundreds of MB). */
export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

/**
 * sha256 of a text file decoded as UTF-8. This is the digest recorded in
 * `prove.json`, so it must keep hashing the decoded text: switching to raw
 * bytes would report drift for manifests written by earlier versions.
 */
export async function hashFileContents(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath, "utf8"))
    .digest("hex");
}

export function pathExists(target: string): Promise<boolean> {
  return access(target).then(
    () => true,
    () => false
  );
}

export async function isFile(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
