---
"@caatinga/core": patch
"@caatinga/client": patch
"@caatinga/cli": patch
"@caatinga/zk": patch
---

feat: add local pre-publish validation orchestrator

Adds `scripts/pre-publish.sh` and `pnpm pre:publish` / `pre:publish:keep-going` scripts at the repo root. Runs the existing local checks (version-alignment, ci-stellar-pin, fixture-references, wasm-target-paths, typecheck, lint, format, docs, build, test) followed by `pnpm publish -r --dry-run --tag <tag>`, with per-stage status, a summary table, fail-fast by default, and `--keep-going` / `--skip` / `--tag` flags. No network, no working-tree mutations — intended as a manual pre-flight before `pnpm publish -r`.
