---
"@caatinga/core": minor
"@caatinga/zk": patch
---

- **fix(core)**: Map `ZK_CHECKSUM_MISMATCH` to public code `CAATINGA_ZK_CHECKSUM_MISMATCH` and preserve error `hint` on fallback branches in `toCaatingaError` (closes #336).
- **compat(core)**: Checksum failures now expose the public code `CAATINGA_ZK_CHECKSUM_MISMATCH` instead of the generic `CAATINGA_UNEXPECTED_ERROR`.
- **fix(zk)**: Reject verification keys not on the BLS12-381 curve during `importCeremony` with `ZK_CEREMONY_INCOMPATIBLE` (closes #329).
- **fix(zk)**: Distinguish subprocess command execution errors from tampered ceremonies during `verifyCeremony`, re-raising execution failures and preserving `cause` (closes #331).
- **fix(zk)**: Report `artifacts-missing` drift status with actionable advisories in `collectZkStatus` when required build artifacts are missing (closes #326).
