---
"@caatinga/cli": patch
---

`ctg status --strict` and `ctg doctor --strict-bindings` help text now says they fail on any binding status other than `fresh` (stale, missing, or unknown), matching their behavior. Behavior is unchanged (#281).
