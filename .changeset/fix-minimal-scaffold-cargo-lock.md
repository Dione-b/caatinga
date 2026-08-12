---
"@caatinga/core": patch
---

Fix `ctg init --minimal` producing a project where `cargo test` fails out of the box.

The minimal contract scaffold shipped no `Cargo.lock`, so Cargo resolved dependencies at
run time and could pick `ed25519-dalek` 3.x alongside 2.x — a combination
`soroban-env-host` 22.1.3 accepts but does not compile against. The scaffold now ships a
lockfile (as the `react-vite-counter` and `zk-starter` templates already did), pinning a
graph that builds and tests cleanly.
