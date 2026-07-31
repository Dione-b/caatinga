# ADR 0002 — Local artifacts and config as source of truth

## Status

Accepted 2026-05-11.

## Context

Soroban dApps need to know **which contract IDs** correspond to which logical names on **which networks**. Duplicating IDs in env vars and READMEs drifts quickly. A central remote registry could solve discovery but introduces trust, availability, supply-chain, and governance problems inappropriate for an MVP core.

## Decision

1. For the MVP and the near-term roadmap, **local project files** are the **source of truth**:
   - `caatinga.config.ts` — project name, networks, contract paths/WASM paths, frontend binding output.
   - `caatinga.artifacts.json` — deployed `contractId`, `wasmHash`, timestamps, and paths, keyed by **network** (same logical contract may differ per network).
   - `contracts/` and **generated bindings** on disk — authoritative integration surface for the frontend.
2. **No required central artifact registry** in core. Optional future services (hosted metadata, dashboards) must remain **optional** and must not be hard dependencies of `@caatinga/core` or `@caatinga/cli`.
3. **Networks vs environments:** today’s model is **per-network** artifacts. A future **environment** dimension (e.g. staging vs production on the same testnet) is acknowledged; it will require a **versioned** artifacts or config evolution and a migration path—not silent overload of “network” semantics.

## Consequences

- **Positive:** Reproducible deploys, simple offline inspection, no Caatinga account or cloud dependency for core flows.
- **Positive:** Aligns with security stance: no exfiltration of deploy metadata by default.
- **Negative:** Teams must share artifacts/config via git or their own secret management—by design.
- **Neutral:** When environments land, expect **`ctg migrate`** (or equivalent) and a bumped `caatinga.artifacts.json` schema version.

## Related

- [`architecture.md`](../architecture.md) — networks vs environments roadmap.
- [ADR 0003](./0003-template-manifest-compatibility.md) — template manifest and `compatibleCore`.
- [ADR 0005](./0005-multi-contract-dependency-deploy.md) — propagating dependency contract IDs without a central registry.
