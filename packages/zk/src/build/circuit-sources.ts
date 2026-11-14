import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ZkError } from "../errors/ZkError.js";

/**
 * sha256 over the circuit sources, sorted by path so the digest is stable
 * regardless of directory iteration order. Hashing the source rather than the
 * compiled `.r1cs` keeps the manifest meaningful to users: it compares equal
 * exactly when the circuit being built is the one the ceremony ran against.
 */
export async function hashCircuitSources(circuitPath: string): Promise<string> {
  const circuitDir = path.resolve(circuitPath);
  const entries = (await readdir(circuitDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".circom"))
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    throw new ZkError(
      `No .circom sources found in ${circuitDir}.`,
      "ZK_CEREMONY_INCOMPATIBLE",
      "Add the circuit sources, or point the circuit `path` in caatinga.config.ts at the directory containing them."
    );
  }

  const hash = createHash("sha256");
  for (const name of entries) {
    hash.update(name);
    hash.update(await readFile(path.join(circuitDir, name), "utf8"));
  }

  return hash.digest("hex");
}
