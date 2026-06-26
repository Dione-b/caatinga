# ADR 0006 — Post-deploy hooks and frontend env sync

## Status

Accepted 2026-06-25.

## Context

Multi-contract Soroban projects often need **admin-signed wiring** after constructors run:
`set_minter`, `set_burner`, and similar authority edges that cannot be set at deploy time
because of circular address dependencies. The [stellar-album](https://github.com/stellar/stellar-album)
course project is the first real consumer: seven contracts, four post-deploy invokes, and a
Vite frontend that reads contract IDs from `frontend/.env.local` instead of
`@caatinga/client` artifacts.

Caatinga already supports topological deploy and `${contracts.<name>.contractId}` placeholders
([ADR 0005](./0005-multi-contract-dependency-deploy.md)). It did not support:

- `${source.address}` for constructor args that need the deployer/admin identity
- Declarative post-deploy invoke sequences
- Syncing deployment artifacts into frontend `.env` files for custom frontends

## Decision

1. Add **`${source.address}`** as a second artifact-safe placeholder, resolved via
   `stellar keys address <source>` at deploy and wire time. Still no `${env.*}` or shell
   interpolation.
2. Add optional **`postDeploy`** hooks in `caatinga.config.ts`, executed by `caatinga wire`
   and automatically after a full `caatinga deploy` (unless `--no-wire`).
3. Add optional **`frontend.envFile`** + **`frontend.env`** mapping, written by
   `caatinga sync-env` and automatically after a full deploy (unless `--no-sync-env`).
4. Add optional **`buildRoot`** for Cargo workspaces: one `stellar contract build` from the
   workspace root instead of per-crate builds.

## Consequences

- Real multi-contract adoption is validated against stellar-album without a bundled template.
- Post-deploy hooks are config, not plugins — the first step toward the plugin roadmap in
  [architecture.md](../architecture.md), without a plugin loader yet.
- Frontends that do not use `@caatinga/client` can still consume Caatinga deploy state via
  generated `.env.local` files.
- `caatinga wire` failures after deploy do not roll back artifacts; recovery is explicit
  (`caatinga wire` or `caatinga deploy --force`).

## Related

- [ADR 0005](./0005-multi-contract-dependency-deploy.md) — deploy graph and contractId placeholders.
- [Case study: stellar-album](../case-studies/stellar-album.md) — end-to-end workflow.
