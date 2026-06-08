# ADR 0004 — Stable error codes as public API

## Status

Accepted 2026-05-11.

## Context

CI pipelines, support playbooks, and programmatic wrappers need **stable identifiers** for failure modes. Ad-hoc messages change; opaque `Error` strings do not compose.

## Decision

1. Expose **stable machine codes** for Caatinga failures using the `CAATINGA_*` namespace.
2. Keep codes centralized in `CaatingaErrorCode`.
3. Document the mapping in `docs/errors.md`.
4. Tests assert error codes for public failure paths.
5. New public error codes must be prefixed before they are exposed.

## Consequences

- Breaking change for anyone parsing legacy pre-`CAATINGA_*` codes; this must be communicated in release notes.
- Enables fixture-based tests that assert on `code` fields, not full English strings.
- Makes stderr/message text easier to improve without breaking CI consumers.

## Related

- [`architecture.md`](../architecture.md) — errors as public API.
- [`errors.md`](../errors.md) — public code reference.
- [ADR 0001](./0001-stable-workflow-over-stellar-cli.md) — wrapped Stellar failures still need stable outer codes.
