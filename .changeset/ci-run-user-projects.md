---
"@caatinga/cli": patch
---

`ctg ci run` now re-runs the installed `ctg` binary for doctor and smoke instead of `./dist/index.js` / `pnpm dev`, so it works in user projects; a failing step stops the recipe and its exit code is propagated (#232).
