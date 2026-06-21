import { describe, expect, it } from "vitest";
import { migrateArtifactsToV2 } from "./migrate-artifacts.js";

describe("migrateArtifactsToV2", () => {
  it("should_bump_version_1_to_2", () => {
    const result = migrateArtifactsToV2({
      project: "app",
      version: 1,
      networks: {
        testnet: { contracts: {}, dependencyGraph: {} },
      },
    });

    expect(result.migrated).toBe(true);
    expect(result.artifacts.version).toBe(2);
    expect(result.artifacts.project).toBe("app");
  });

  it("should_noop_when_already_v2", () => {
    const artifacts = {
      project: "app",
      version: 2 as const,
      networks: {},
    };

    const result = migrateArtifactsToV2(artifacts);
    expect(result.migrated).toBe(false);
    expect(result.artifacts).toBe(artifacts);
  });
});
