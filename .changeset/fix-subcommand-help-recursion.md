---
"@caatinga/cli": patch
---

Fix `--help` on every subcommand crashing with `Maximum call stack size exceeded`.

The custom root help formatter delegated back to `helper.formatHelp`, but `configureHelp`
replaces `formatHelp` on the helper itself, so the subcommand branch re-entered the override
and overflowed the stack. It now calls Commander's built-in formatter directly.
