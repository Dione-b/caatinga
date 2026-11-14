---
"@caatinga/cli": patch
"@caatinga/zk": patch
---

**`ctg zk init` no longer breaks a config whose verifier entry ends in a comment.** When adding `deployArgs: { admin: "${source.address}" }` to an existing `verifier` entry, the separating comma was appended to the end of the last line, so a trailing `// comment` swallowed it and the rewritten `caatinga.config.ts` failed to parse. The comma now goes after the last code token; comments stay in place.

**The missing-admin warning now checks the verifier entry itself.** It used to look for any `deployArgs: { admin }` in the whole file, so another contract with an admin (a token, for example) silenced the warning for a verifier entry it could not rewrite. Commented-out `deployArgs` and paths that only appear in comments are ignored as well.

**`ctg zk invoke --embed-vk` keeps the original trap.** The `CAATINGA_ZK_EMBED_VK_UNSUPPORTED` error now keeps the Stellar CLI failure as its cause and shows the trap lines in the hint, so a panic that is not the placeholder key is still diagnosable. Detection also follows re-wrapped errors down their cause chain, and recognizes the trap from the host error `Error(WasmVm, InvalidAction)` alone: Stellar CLI 28.1 prints the `UnreachableCodeReached` diagnostic event only with `-v`, so on testnet the trap previously fell through to a generic `CAATINGA_INVOKE_FAILED`.
