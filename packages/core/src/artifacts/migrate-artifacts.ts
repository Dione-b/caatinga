import type {
  CaatingaArtifacts,
  CaatingaArtifactsV1,
  CaatingaArtifactsV2,
} from "./artifact.schema.js";
import { CURRENT_ARTIFACTS_SCHEMA_VERSION } from "./artifact.schema.js";

export type MigrateArtifactsResult = {
  artifacts: CaatingaArtifactsV2;
  migrated: boolean;
};

export function migrateArtifactsToV2(artifacts: CaatingaArtifacts): MigrateArtifactsResult {
  if (artifacts.version === CURRENT_ARTIFACTS_SCHEMA_VERSION) {
    return {
      artifacts: artifacts as CaatingaArtifactsV2,
      migrated: false,
    };
  }

  const v1 = artifacts as CaatingaArtifactsV1;
  return {
    artifacts: {
      project: v1.project,
      version: CURRENT_ARTIFACTS_SCHEMA_VERSION,
      networks: v1.networks,
    },
    migrated: true,
  };
}
