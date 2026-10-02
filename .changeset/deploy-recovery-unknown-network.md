---
"@caatinga/core": patch
---

Deploy recovery no longer masks `DEPLOY_FAILED` with `NETWORK_NOT_FOUND` on custom or unmapped networks. When there is no Horizon URL, or the salt and contract-id lookup fails after a Horizon hit, recovery returns null so the original deploy error and its retry path stay intact (#234).
