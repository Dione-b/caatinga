---
"@caatinga/core": patch
"@caatinga/cli": patch
---

New projects now start on the current artifacts schema (`version: 2`). The `react-vite-counter` and `zk-starter` templates shipped `"version": 1` in `caatinga.artifacts.json`, so `ctg init` / `ctg zk init` projects stayed on v1 until their first upgrade or redeploy, while `ctg init --minimal` already started on v2. Templates now ship v2, and scaffolding migrates any template that still ships v1 (for example a custom template via `CAATINGA_TEMPLATES_DIR`). Existing project files are not touched (#280).
