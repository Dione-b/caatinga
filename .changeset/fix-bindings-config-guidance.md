---
"@caatinga/core": patch
"@caatinga/cli": patch
---

Show the config snippet `generate` needs, instead of naming the field in prose.

`ctg generate` fails with `CAATINGA_INVALID_CONFIG` when no `frontend.bindingsOutput` is
configured — which is every `--minimal` project. The hint named the field but not its shape,
so users had to read the Zod schema in the installed bundle to learn it. Worse, `doctor` and
`status` recommended running `generate` in exactly this state, which is guaranteed to fail.

All three now print the exact snippet to paste, from one shared helper so they cannot drift,
and the minimal scaffold's README documents how to enable bindings. `doctor`/`status` only
recommend `generate` once it can actually run.
