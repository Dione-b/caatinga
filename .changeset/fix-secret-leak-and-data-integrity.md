---
"@caatinga/cli": patch
"@caatinga/core": patch
---

**Security fix — action required if you have ever run `ctg identity export` or `ctg identity import`.**

Earlier versions wrote a tarball of your Stellar config (including secret keys) to
`os.tmpdir()` and never deleted it. Upgrading stops new archives being left behind, but it
cannot remove the ones already there. Check every machine and CI image where those commands
ran:

```bash
ls -la /tmp/caatinga-stellar-*.tar.gz
```

Delete anything it lists — those files contain key material and were created world-readable
under a typical umask. Rotate the affected keys if the machine is shared or the files may
have been collected by CI artifact upload or backups.

Fix one secret-handling flaw and three data-integrity bugs:

- `ctg identity export`/`import` no longer leave a tarball of `~/.config/stellar` behind in `os.tmpdir()`. The archive used a predictable `Date.now()` name and default permissions and was never deleted, so exported key material stayed readable by other users of the machine or CI runner. It is now written inside a `0700` `mkdtemp` directory under a random name and removed in a `finally` block, so it never outlives the command even when it fails.
- `ctg sync-env` (and the env sync that runs after `ctg deploy`) no longer wipes the target env file. It rebuilt the file from the keys mapped in `frontend.env`, silently destroying any other variable living there — API keys, third-party secrets, feature flags. Only the managed keys are rewritten now; unrelated assignments, comments and blank lines are left untouched, and new keys are appended.
- Concurrent `ctg deploy`/`ctg upgrade` runs no longer drop each other's `contractId`. Both read `caatinga.artifacts.json` up front and wrote it back after the whole async deploy, so the second process overwrote the file from a stale snapshot. Artifact updates are now serialized with a lockfile and re-read inside the lock.
- `parseContractId` no longer mistakes a lookalike token for the deployed contract ID. It took the first `C…` match in the combined stdout/stderr of `stellar contract deploy`, but diagnostics are emitted before the real result, so a warning line could supply the ID persisted to `caatinga.artifacts.json`. It now prefers the last explicitly labeled line, then the last standalone ID line, then the last bare match, and restricts the character class to the base32 alphabet strkeys actually use (`A-Z2-7`).

`@caatinga/cli` also now depends on `@caatinga/zk` `^3.9.1`, matching the rest of the release group.
