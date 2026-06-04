---
"@caatinga/core": patch
"@caatinga/client": patch
"@caatinga/cli": patch
---

fix: clarify build versus deploy artifact flow

`caatinga init` now preserves template artifact network scaffolds instead of replacing them with an empty `networks` object. The client now reports contextual deploy hints when a contract ID is missing, and `caatinga build` prints a non-failing reminder when the default network still needs deploy records.
