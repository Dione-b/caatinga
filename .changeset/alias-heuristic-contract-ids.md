---
"@caatinga/core": patch
---

Method args that are contract IDs (`C...`), muxed addresses (`M...`), integers or 64-char hex values are no longer treated as CLI identity aliases. Resolved `${contracts.<name>.contractId}` placeholders in `postDeploy`, `postDeployRead` and `smoke.reads`, and numeric or hash args in `ctg invoke` / `ctg read`, no longer fail with `CAATINGA_ADDRESS_ALIAS_UNRESOLVED`.
