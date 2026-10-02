---
"@caatinga/core": patch
"@caatinga/cli": patch
---

`ctg inspect` now shows the Stellar CLI output in the on-chain `detail` when the contract probe fails. `verifyDependencyContract` keeps the `runCommand` error as the `cause` of `DEPENDENCY_CONTRACT_NOT_FOUND`, so the raw CLI diagnostics reach callers. `ctg generate` now says `Set "buffer" to ^6` instead of `Added "buffer"`, since an out-of-range `buffer` entry is updated in place.
