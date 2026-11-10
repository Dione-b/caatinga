import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "../fs/atomic-write-file.js";
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

  await atomicWriteFile(artifactsPath, `${JSON.stringify(validated, null, 2)}\n`);

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
