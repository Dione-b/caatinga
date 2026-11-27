---
"@caatinga/zk": patch
---

On platforms where iden3/circom publishes no release asset (macOS arm64, Linux arm64, Windows), `ctg zk build` now uses a circom 2.1.9 or newer 2.x found through `CAATINGA_CIRCOM` or on `PATH` instead of failing with `CAATINGA_ZK_UNSUPPORTED_PLATFORM`. The version is checked with `circom --version` and the status line says the binary is not checksum-verified by Caatinga. Downloads on linux-amd64 and macos-amd64 are still pinned and verified exactly as before, and the error hint now describes what actually works.
