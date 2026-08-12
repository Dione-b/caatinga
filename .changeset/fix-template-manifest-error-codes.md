---
"@caatinga/core": patch
---

Throw `CaatingaError` instead of raw `Error` from the template manifest helpers.

`defaultCompatibleCoreRange` and `assertOfficialTemplateManifest` threw plain `Error`s, which
the CLI normalized to `CAATINGA_UNEXPECTED_ERROR` — discarding the `INVALID_TEMPLATE_MANIFEST`
and `TEMPLATE_INCOMPATIBLE` codes that describe what actually went wrong. All three now carry
the right code plus an actionable hint, reusing `formatTemplateCompatibilityHint` for the
compatibility case.
