---
"@caatinga/cli": patch
---

Fix `ctg zk init` when adding ZK to an existing project: the default mode now copies `contracts/verifier` (previously only `circuits/` was copied), and the config merge adds the missing comma after a last contract entry without one (as written by `ctg init --minimal`) instead of producing invalid TypeScript.

`ctg zk init` in an existing project also no longer reports every config load failure as `No caatinga.config.ts found`: errors such as `CAATINGA_DEPENDENCIES_NOT_INSTALLED` (run `npm install` first) or `CAATINGA_INVALID_CONFIG` are now shown as is.
