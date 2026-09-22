import { randomBytes } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CaatingaArtifactsSchema, type CaatingaArtifacts } from "./artifact.schema.js";

export async function writeArtifacts(
  artifacts: CaatingaArtifacts,
  cwd = process.cwd()
): Promise<string> {
  const artifactsPath = path.resolve(cwd, "caatinga.artifacts.json");
  await mkdir(path.dirname(artifactsPath), { recursive: true });

  // Re-validate before persisting: a malformed contractId/wasmHash written here
  // would otherwise only surface as a hard read failure on the next readArtifacts
  // call, after it's already the trusted record for signed transactions.
  const validated = CaatingaArtifactsSchema.parse(artifacts);

  const tmpPath = `${artifactsPath}.${randomBytes(4).toString("hex")}.tmp`;
  const payload = `${JSON.stringify(validated, null, 2)}\n`;

  try {
    await writeFile(tmpPath, payload, "utf8");
    await rename(tmpPath, artifactsPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined);
    throw error;
  }

  return artifactsPath;
}

export type CreateInitialArtifactsOptions = {
  networks?: string[];
};

export function createInitialArtifacts(
  project: string,
  options: CreateInitialArtifactsOptions = {}
): CaatingaArtifacts {
  const networks = Object.fromEntries(
    Array.from(new Set(options.networks ?? [])).map((network) => [
      network,
      {
        contracts: {},
        dependencyGraph: {},
      },
    ])
  );

  return {
    project,
    version: 2,
    networks,
  };
}
