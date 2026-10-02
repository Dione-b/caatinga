---
"@caatinga/core": patch
---

Preserve intentional non-semver `buffer` dependency protocols and update out-of-range versions in their existing dependency section. Contract inspection now falls back to the configured WASM path when the deployed artifact path is missing, and `inspectContract().localWasm.path` now reports the absolute resolved path that was hashed instead of the configured `wasm` value. Inspection diagnostics no longer include deploy-only `--verify-deps` guidance. Also remove unreachable frontend network-key validation branches.
