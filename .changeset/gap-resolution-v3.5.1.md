---
"@caatinga/core": minor
---

Add Radox gap resolution features:

- `buildFeatures` per contract for Cargo feature gates
- `.wasmHash` suffix in `frontend.env` mappings for WASM hash sync
- `source` override per `postDeploy` hook
- `expect` assertion in `postDeploy` hooks with `POST_DEPLOY_VERIFY_FAILED` error
- Validate per-hook `source` through `assertSafeSourceAccount`
