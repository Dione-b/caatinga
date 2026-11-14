---
"@caatinga/cli": patch
"@caatinga/core": patch
"@caatinga/zk": minor
---

**Internal restructuring of the ZK flow; no command changes behaviour.** Artifact file names and paths, file hashing, verification-key and `r1cs info` parsing, and the embedded-VK helpers each live in one module now instead of being repeated across build, prove, invoke, ceremony import/verify and status. `@caatinga/zk` additionally exports `zkArtifactPaths`, `embeddedVkSourcePath`, `isPlaceholderEmbeddedVk` and `CIRCUIT_INPUT_FILE`; every existing export is unchanged.

**`ctg zk prove` and `ctg zk invoke` name the real problem when the config has no circuits.** They used to report `Circuit "undefined" not found`; all `ctg zk` commands now share one message, `No ZK circuits configured in caatinga.config.ts`, and `ctg zk invoke <name>` with an unknown name reports that the circuit was not found rather than that its verifier contract is missing.
