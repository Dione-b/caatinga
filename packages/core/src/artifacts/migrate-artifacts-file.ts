import { readArtifacts } from "../artifacts/read-artifacts.js";
import { migrateArtifactsToV2 } from "./migrate-artifacts.js";
import { writeArtifacts } from "./write-artifacts.js";

export async function migrateArtifactsFile(cwd = process.cwd()) {
  const artifacts = await readArtifacts(cwd);
  const { artifacts: migrated, migrated: changed } = migrateArtifactsToV2(artifacts);
  const path = await writeArtifacts(migrated, cwd);
  return { path, migrated: changed, artifacts: migrated };
}
