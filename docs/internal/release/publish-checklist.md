# Publish Checklist

## Before `next`

- verify package READMEs are current for `@caatinga/cli`, `@caatinga/client`, `@caatinga/core`, and `@caatinga/zk`
- verify `.github/workflows/release-gate.yml` passed for the intended tag or release candidate
- apply pending changesets with `pnpm exec changeset version` (fixed group: all four packages bump together), then `pnpm install` and commit `pnpm-lock.yaml`
- run `pnpm pre:publish` (`scripts/pre-publish.sh`; local, no-network checks ending in a publish dry-run)
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
  defined in `packages/core/src/stellar-cli/version.ts` (re-exported from `compat.ts`). Bumping the last-tested
  value is **not** a breaking change (advisory only); bumping the minimum is a hard
  failure and requires a major version.
- Call out any removed public error codes, removed CLI flags, and any new
  `STELLAR_CLI_*` warning codes surfaced through `Diagnostic.warnings`.

```bash
pnpm exec changeset version
pnpm install
pnpm pre:publish
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
bash scripts/promote-latest.sh <version> --otp <code-from-authenticator>
```

The script moves `latest` for `cli`, `core`, `client`, and `zk`, then prints each package's
dist-tags. Confirm with `npm view @caatinga/cli dist-tags`.

After promotion, verify the published binaries without `@next`:

```bash
npx @caatinga/cli --help
npx --package=@caatinga/cli ctg --help
```

The former "v1 gate" (targeting npm `1.0.0`) is historical: the v1.0 stable contract ships on
the `3.x` line. See [`v1.0.0.md`](./v1.0.0.md) for the original v1 release criteria.
