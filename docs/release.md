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

The `Release Gate` workflow validates release readiness with typecheck, docs, build, tests,
snapshot packing, publish dry-run, and consumer package checks. It does not publish to npm
or create a GitHub Release.

## Release Notes

Release notes must include Node.js, Stellar CLI, and Rust compatibility, plus any breaking
changes or public error-code changes.

See the operator checklist in [`release/publish-checklist.md`](./release/publish-checklist.md)
and the stable release contract in [`release/v1.0.0.md`](./release/v1.0.0.md).
