---
"@caatinga/cli": patch
---

`ctg wire` and full-graph `ctg deploy` auto-wiring now run when only `postDeployRead` hooks are configured. Previously `ctg wire` printed "No postDeploy hooks configured" and did nothing, and deploy skipped wiring unless a `postDeploy` array existed, so the "run `ctg wire` to recover" hint was a no-op for read-only hook configs (#243).
