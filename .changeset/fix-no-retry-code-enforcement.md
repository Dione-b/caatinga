---
"@caatinga/core": patch
---

Enforce the no-retry error list against `error.code` instead of hoping the code appears in
the message text.

`isTransientCommandFailure` only ever scanned text for `CAATINGA_*` markers, so callers that
passed a thrown error's `message + hint` could never match the list — `CaatingaError` keeps
its code on the `code` property. A new `isTransientCaatingaFailure(error, retryableCode)`
reads the code directly, and the deploy, upgrade, and post-deploy-hook retry paths now share
it instead of each re-implementing the check. The list itself is typed against
`CaatingaErrorCode`, so a stale entry becomes a compile error.
