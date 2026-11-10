---
"@caatinga/core": patch
---

`evaluateWasmDrift` now validates the network with `resolveNetwork` and throws `CAATINGA_NETWORK_NOT_FOUND` for unknown networks instead of silently reporting no drift (#87).
