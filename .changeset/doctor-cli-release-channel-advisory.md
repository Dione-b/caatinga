---
"@caatinga/cli": minor
---

`caatinga doctor` and `caatinga version` now compare the running CLI version against the npm `dist-tags` for `@caatinga/cli` and print an informational note when the install is ahead of the `latest` tag (for example a `next`-tagged pre-release, naming the matching tag) or behind it (with the update command). The check never fails a command or affects doctor readiness: it is skipped silently when npm or the registry is unavailable, times out after five seconds, and honors `CAATINGA_SKIP_UPDATE_CHECK=1`.
