---
"@caatinga/zk": patch
---

snarkjs is now installed from a committed lockfile with `npm ci --ignore-scripts`, so every transitive package is pinned to an exact version and sha512 integrity and no dependency install script runs. The cache moves to `~/.caatinga/zk-tools/snarkjs-0.7.5-locked`, so installs made before this pin are not reused; the first ZK command after upgrading reinstalls snarkjs once.
