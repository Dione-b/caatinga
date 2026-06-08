# ADR 0005 — Multi-contract dependency deploy

## Status

Accepted 2026-05-11.

## Context

Multi-contract deployment is the first Caatinga workflow that is materially more useful than ad-hoc package scripts. Dependents need upstream `contractId`s without unsafe shell interpolation or environment mutation.

After single-contract MVP, Caatinga must prove **multi-contract** workflows: build and deploy order, dependency edges, binding generation for multiple contracts, and invocations that rely on more than one deployed ID.

## Decision

Caatinga core owns `dependsOn`, topological deploy order, and `${contracts.<contractName>.contractId}` placeholder resolution. The placeholder language is intentionally narrow and reads only from `caatinga.artifacts.json`.

Stellar CLI constructor arguments are passed after `--` using `--snake_case` flags derived from `deployArgs` keys.

## Consequences

- Dependency deploy order is deterministic and testable.
- Artifact schema version remains `1` because new fields are optional and backward-compatible.
- Environment variables, `${env.*}`, and `$(...)` shell interpolation are rejected for deploy arg placeholders: deploy args are data passed to Stellar CLI, not a second templating language; keeping resolution artifact-only avoids non-reproducible deploys.
- The feature is experimental until at least one real multi-contract template is validated.

## Related

- [`architecture.md`](../architecture.md) — multi-contract section.
- [ADR 0002](./0002-local-artifacts-as-source-of-truth.md) — IDs remain local artifacts, not a central registry.
- [ADR 0003](./0003-template-manifest-compatibility.md) — template manifests gate the experimental multi-contract template.
