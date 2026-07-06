# Artifacts Versioning Strategy

This document defines the schema evolution, migration rules, and compatibility policies for `caatinga.artifacts.json`.

---

## 1. Schema Versioning Rules

We enforce a strict versioning convention for the `caatinga.artifacts.json` format:

- **Incremental Bumps:** Schema versions are represented by sequential integers (1, 2, 3, etc.) defined in the root `version` field.
- **Non-Breaking Changes (Minor updates):** Adding optional fields (e.g. metadata) does not require changing the schema version. The format remains fully compatible.
- **Breaking Changes (Major updates):** Modifying structural shapes, changing required types, or removing fields requires a schema version increment (e.g., from `2` to `3`) and the implementation of an explicit migration script in the Orchestration Engine.

---

## 2. Compatibility Matrix

To avoid lock-in and support teams upgrading their CLI, Caatinga implements the following rules:

### Backward Compatibility (Old files in New CLI)

- **Automatic Migration:** When reading old artifacts files (e.g. version 1), the Orchestration Engine automatically migrates the shape to the current version in memory using `migrateArtifactsToV2`.
- **Automatic Writeback:** Running `caatinga deploy` or `caatinga upgrade` on an old schema version automatically writes the updated, migrated format to disk, upgrading the project's artifacts file.

### Forward Compatibility (New files in Old CLI)

- **Safety Fail-Fast:** If the Orchestration Engine detects an artifacts file version greater than `CURRENT_ARTIFACTS_SCHEMA_VERSION` (e.g., `parsedJson.version > 2`), it immediately halts execution with a `CAATINGA_ARTIFACT_INVALID` error.
- **Why this matters:** Preventing older CLIs from parsing newer schemas protects users from corrupted metadata state or loss of registry history.

---

## 3. Creating a New Schema Migration

When a future breaking change is introduced:

1. **Schema Definition:**
   - Define the new schema version in `packages/core/src/artifacts/artifact.schema.ts` (e.g. `CaatingaArtifactsV3Schema`).
   - Bump `CURRENT_ARTIFACTS_SCHEMA_VERSION` to the new version number.
   - Update `CaatingaArtifactsSchema` union.
2. **Migration Code:**
   - Create a migration function `migrateArtifactsToV3` in `packages/core/src/artifacts/migrate-artifacts.ts`.
   - Update `migrateArtifactsFile` to invoke the chain of migrations sequentially (v1 → v2 → v3).
3. **Test Coverage:**
   - Add unit test fixtures capturing old schema files and verify they convert correctly.

---

## 4. Automated compatibility tests

Run from the repository root:

```bash
pnpm test:compat
```

This executes:

- `packages/core/src/compat/compat.test.ts` — v1/v2 fixtures, migration roundtrip, `migrateArtifactsFile`
- `packages/core/src/compat/exports-snapshot.test.ts` — `@caatinga/core` and `@caatinga/client` `package.json` exports
- `packages/core/src/public-api/export-manifest.test.ts` — Tier 1 client export manifest
- `packages/core/src/recovery/recovery-scenarios.test.ts` — artifact and CLI recovery paths

Fixtures live in `packages/core/src/compat/fixtures/`.

Consumer isolation (`pnpm test:consumer`) validates packed tarball installs end-to-end.
