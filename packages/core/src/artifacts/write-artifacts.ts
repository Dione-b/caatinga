import path from "node:path";
import { atomicWriteFile } from "../fs/atomic-write-file.js";
import type { CaatingaArtifacts } from "./artifact.schema.js";

export async function writeArtifacts(
  artifacts: CaatingaArtifacts,
  cwd = process.cwd()
): Promise<string> {
  const artifactsPath = path.resolve(cwd, "caatinga.artifacts.json");
  await atomicWriteFile(artifactsPath, `${JSON.stringify(artifacts, null, 2)}\n`);
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
