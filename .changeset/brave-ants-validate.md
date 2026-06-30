---
"@caatinga/core": patch
---

Validate multi-contract dependency graphs while loading config.

Caatinga now fails fast when `dependsOn` references are missing, dependency cycles exist, or `${contracts.<name>.contractId}` deploy arg placeholders are not declared in `dependsOn`.
