---
"@caatinga/cli": patch
"@caatinga/core": patch
---

`ctg doctor` now fails the Rust check for toolchains that `stellar contract build` refuses (1.81.x, 1.82.x, 1.83.x and 1.91.0) instead of reporting them as OK, and `RUST_MIN_VERSION` is raised to 1.91.1. Templates and scaffolds declare `rust-version = "1.91.1"`. Exposes `RUST_BLOCKED_VERSIONS` from `@caatinga/core/runtime/requirements`.
