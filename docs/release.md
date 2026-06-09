# Release Process

## Workspace Version

The root package is private and is not published.

## Public Packages

The following packages are published:

- `@caatinga/cli`
- `@caatinga/core`
- `@caatinga/client`

Template files are bundled with `@caatinga/cli`; there is no separate public
`@caatinga/templates` package in the current workspace.

## Version Alignment

Public packages should remain version-aligned during alpha unless there is a deliberate exception.
Any exception must be called out in release notes and package changelogs.

## Dist Tags

- `alpha`
- `beta`
- `next`
- `latest`

## Release Gate

The `Release Gate` workflow (`.github/workflows/release-gate.yml`) validates release readiness
with typecheck, docs, build, tests, snapshot packing, publish dry-run, and consumer package
checks. It does not publish to npm or create a GitHub Release.

## GitHub Releases

GitHub Releases document alpha milestones for contributors and early adopters. Publishing a
release on GitHub is a manual step after the Release Gate passes. See
[`docs/release/v0.2.1-alpha.0.md`](./release/v0.2.1-alpha.0.md) for the first alpha notes.

## Release Notes

Release notes must include Node.js, Stellar CLI, and Rust compatibility, plus any breaking
changes or public error-code changes.

For Stellar CLI compatibility, report the value of `STELLAR_CLI_MIN_VERSION` and
`STELLAR_CLI_LAST_TESTED_VERSION` from `packages/core/src/stellar-cli/compat.ts` so
consumers know which boundary has been validated. Bumping `STELLAR_CLI_LAST_TESTED_VERSION`
alone does not require a new major version; bumping `STELLAR_CLI_MIN_VERSION` is a
breaking change because the hard floor is enforced at runtime.

See the operator checklist in [`release/publish-checklist.md`](./release/publish-checklist.md)
and the stable release contract in [`release/v1.0.0.md`](./release/v1.0.0.md).

## Package changelogs

Each published package maintains its own Changesets-generated changelog under
`packages/cli/CHANGELOG.md`, `packages/core/CHANGELOG.md`, and `packages/client/CHANGELOG.md`.
Those files include a **Breaking changes policy** header that links to the v1 public API contract
in [`release/v1.0.0.md`](./release/v1.0.0.md) and the `CAATINGA_*` error reference in
[`errors.md`](./errors.md). There is no root `CHANGELOG.md`; use the package changelog for the
package you depend on.
