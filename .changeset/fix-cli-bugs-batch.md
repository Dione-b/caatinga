---
"@caatinga/cli": patch
"@caatinga/core": patch
---

Fix four CLI bugs across `zk init`, `read`, and `doctor`:

- `caatinga zk init --force` no longer crashes with `ENOENT` when the project's `node_modules` contains a dangling symlink. The template-variable pass now skips excluded directories (`node_modules`, `target`, `.git`, `test_snapshots`) and uses `lstat`, so symlinks are never dereferenced.
- `caatinga read` now discloses which Stellar source identity it resolved and where it came from (`CAATINGA_SOURCE` or the built-in `alice` default) when `-s/--source` is omitted, and the flag help documents the fallback. Explicit `--source` stays silent.
- `caatinga doctor` reports `Project dependencies not installed` exactly once instead of twice before `npm install`.
- `caatinga doctor` no longer falsely reports `network <name> not found` before `npm install`; the network check is skipped when the config cannot load due to missing dependencies.
