---
"@caatinga/core": patch
"@caatinga/cli": patch
---

`ctg estimate deploy` now simulates against the selected network and reads fees from the simulated envelope (`fee` minus `resource_fee` for inclusion), so estimates are produced and no longer double-count (#225).
