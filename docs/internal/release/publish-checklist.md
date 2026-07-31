# Publish Checklist

## Before `next`

- verify package READMEs are current for `@caatinga/cli`, `@caatinga/client`, `@caatinga/core`, and `@caatinga/zk`
- verify `.github/workflows/release-gate.yml` passed for the intended tag or release candidate
- run `pnpm typecheck`
- run `pnpm build`
- run `pnpm test`
- run `pnpm test:consumer`
- run `pnpm test:consumer:client-bundlers`
- run `pnpm ci:publish-matrix`

The release gate does not publish to npm and does not create a GitHub Release. It validates
typecheck, docs, build, tests, snapshot packing, publish dry-run, and consumer package checks.
Actual npm publishing and GitHub Release creation remain operator-controlled until the release
automation contract is deliberately implemented.

## Release notes

- Report the current `STELLAR_CLI_MIN_VERSION` and `STELLAR_CLI_LAST_TESTED_VERSION`
  exported from `packages/core/src/stellar-cli/compat.ts`. Bumping the last-tested
  value is **not** a breaking change (advisory only); bumping the minimum is a hard
  failure and requires a major version.
- Call out any removed public error codes, removed CLI flags, and any new
  `STELLAR_CLI_*` warning codes surfaced through `Diagnostic.warnings`.

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:consumer
pnpm test:consumer:client-bundlers
pnpm ci:publish-matrix
```

## Before `latest`

- complete every `next` check above
- verify release owner approval for the `latest` promotion
- confirm `npm view @caatinga/cli@next version` is published

Promote an already-published version (no republish) by moving the `latest` dist-tag:

```bash
VERSION=3.7.0
OTP=<code-from-authenticator>
for pkg in cli core client zk; do
  npm dist-tag add "@caatinga/$pkg@$VERSION" latest --otp="$OTP"
done
npm view @caatinga/cli dist-tags
```

After promotion, verify setup is available without `@next`:

```bash
npx @caatinga/cli setup --help
```

Optional v1 gate (when targeting stable `1.0.0`):

- verify all five v1 specs are implemented and accepted
- verify three consecutive scheduled `Testnet Smoke` runs succeeded
- verify no unretried smoke failure occurred in the previous 7 days
- verify the release evidence section in `docs/internal/release/v1.0.0.md` is complete
