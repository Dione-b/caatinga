# Testnet hygiene (GAP-07)

Integration tests on shared testnet identities accumulate on-chain state (mints, allocations, anchors). That breaks strict `expect: "[]"` postDeploy checks on redeploy.

## Practices

1. **Ephemeral writes** — generate a unique Symbol or truncated UUID per test run for write paths; never reuse the same key in repeated CI jobs.
2. **Read-only smoke identity** — use a separate `--source` (or hook `source`) for read-only smoke that never receives write hooks.
3. **`postDeployRead` + structural expects** — prefer `{ matcher: "isArray" }` or `{ matcher: "reachable" }` over empty-array equality.
4. **`caatinga read --summary`** — compact output for large array payloads in daily smoke scripts.
5. **`smoke.useFreshSymbol`** — optional config hint for templates generating fresh keys.

See also [config.md](./config.md) postDeploy section and [errors.md](./errors.md) for `CAATINGA_POST_DEPLOY_VERIFY_FAILED`.
