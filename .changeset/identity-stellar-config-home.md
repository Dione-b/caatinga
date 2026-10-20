---
"@caatinga/cli": patch
---

`ctg identity export` and `ctg identity import` default to the Stellar config directory from `STELLAR_CONFIG_HOME`, then `STELLAR_HOME`, then `XDG_CONFIG_HOME/stellar`, falling back to `~/.config/stellar` as before. Empty values are ignored, and `--path` still overrides the default.
