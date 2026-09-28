---
"@caatinga/cli": patch
---

`ctg identity export` now writes only the base64 archive to stdout; status goes to stderr, so `ctg identity export > id.b64` round-trips through `ctg identity import` (#227).
