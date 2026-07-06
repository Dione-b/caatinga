import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaArtifactsSchema } from "../artifacts/artifact.schema.js";
import { migrateArtifactsFile } from "../artifacts/migrate-artifacts-file.js";
import { migrateArtifactsToV2 } from "../artifacts/migrate-artifacts.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { writeArtifacts } from "../artifacts/write-artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
}

describe("compatibility: artifacts schema", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_parse_v1_fixture_and_migrate_to_v2", () => {
    const v1 = loadFixture("artifacts-v1.json");
    const parsed = CaatingaArtifactsSchema.parse(v1);
    const { artifacts, migrated } = migrateArtifactsToV2(parsed);

    expect(migrated).toBe(true);
    expect(artifacts.version).toBe(2);
    expect(artifacts.networks.testnet?.contracts.counter?.contractId).toBe(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"
    );
  });

  it("should_roundtrip_v2_minimal_fixture", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-compat-"));
    const v2 = loadFixture("artifacts-v2-minimal.json");
    await writeFile(
      path.join(tmpDir, "caatinga.artifacts.json"),
      `${JSON.stringify(v2)}\n`,
      "utf8"
    );

    const loaded = await readArtifacts(tmpDir);
    expect(loaded.version).toBe(2);

    const written = await writeArtifacts(loaded, tmpDir);
    const roundtrip = JSON.parse(await readFile(written, "utf8"));
    expect(roundtrip).toEqual(v2);
  });

  it("should_preserve_v2_full_metadata_fixture", () => {
    const v2 = loadFixture("artifacts-v2-full-metadata.json");
    const parsed = CaatingaArtifactsSchema.parse(v2);
    const { artifacts, migrated } = migrateArtifactsToV2(parsed);

    expect(migrated).toBe(false);
    expect(artifacts.networks.testnet?.contracts.token?.metadata?.gitCommit).toBe("abc1234");
    expect(artifacts.networks.testnet?.contracts.vault?.dependencies).toEqual(["token"]);
  });

  it("should_migrate_v1_fixture_on_disk_via_migrateArtifactsFile", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-compat-"));
    const v1 = loadFixture("artifacts-v1.json");
    await writeFile(
      path.join(tmpDir, "caatinga.artifacts.json"),
      `${JSON.stringify(v1)}\n`,
      "utf8"
    );

    const result = await migrateArtifactsFile(tmpDir);
    expect(result.migrated).toBe(true);
    expect(result.artifacts.version).toBe(2);

    const onDisk = JSON.parse(
      await readFile(path.join(tmpDir, "caatinga.artifacts.json"), "utf8")
    );
    expect(onDisk.version).toBe(2);
  });
});
