# ADR 0003 — Template manifest and core compatibility

## Status

Accepted 2026-05-11.

## Context

Official and community templates need a **declared contract** against `@caatinga/core` / CLI versions. Without a manifest, `ctg init` relies on implicit directory layout and human documentation, which drifts and breaks semver intent.

## Decision

Each template must include **`caatinga.template.json`**, including:

- Template name and semver.
- **`caatinga.compatibleCore`** (or equivalent) range for supported `@caatinga/core` versions.
- Declared paths: contracts root, `caatinga.config.ts`, `caatinga.artifacts.json`, frontend kind (`vite-react`, etc.).

`ctg init` validates compatibility before copy and fails with:

- `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND` when the manifest is missing.
- `CAATINGA_INVALID_TEMPLATE_MANIFEST` when the manifest JSON/schema is invalid.
- `CAATINGA_TEMPLATE_INCOMPATIBLE` when the manifest is valid but incompatible with the current core version.

## Consequences

- Enables CI matrix: template × core versions.
- Requires release discipline: bump template when core breaks layout contract.
- Makes template copy fail earlier, before partial project creation from an incompatible template.

## Related

- [`architecture.md`](../architecture.md) — extensibility section.
- [`templates.md`](../templates.md) — manifest schema and compatibility behavior.
- [ADR 0002](./0002-local-artifacts-as-source-of-truth.md) — local artifacts are the source of truth, including template metadata.
