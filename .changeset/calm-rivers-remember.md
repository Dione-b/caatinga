---
"@caatinga/core": patch
---

Preserve intentional non-semver `buffer` dependency protocols and update out-of-range versions in their existing dependency section. Contract inspection now falls back to the configured WASM path when the deployed artifact path is missing, and its `localWasm.path` remains an absolute resolved path. Inspection diagnostics no longer include deploy-only `--verify-deps` guidance. Also remove unreachable frontend network-key validation branches.
