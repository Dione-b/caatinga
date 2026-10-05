---
"@caatinga/cli": patch
---

Fix `ctg zk init` when adding ZK to an existing project: the default mode now copies `contracts/verifier` (previously only `circuits/` was copied), and the config merge adds the missing comma after a last contract entry without one (as written by `ctg init --minimal`) instead of producing invalid TypeScript.
