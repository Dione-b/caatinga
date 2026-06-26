---
"@caatinga/cli": minor
"@caatinga/core": minor
---

Add a declarative multi-contract workflow validated against stellar-album:

- `${source.address}` placeholder for deploy/wire args, resolved via `stellar keys address <source>`.
- `postDeploy` hooks in `caatinga.config.ts`, run by the new `caatinga wire` command and automatically after a full `caatinga deploy` (skip with `--no-wire`).
- `frontend.envFile` + `frontend.env` mapping, written by the new `caatinga sync-env` command and automatically after a full deploy (skip with `--no-sync-env`).
- `buildRoot` for Cargo workspaces: a single `stellar contract build` from the workspace root instead of per-crate builds.
- New error code `CAATINGA_SOURCE_ADDRESS_UNRESOLVED`.

See ADR 0006 and the stellar-album case study for the design rationale.
