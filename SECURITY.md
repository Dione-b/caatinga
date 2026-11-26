# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and
choose **Report a vulnerability**. Do not open a public issue for a security problem.

Include the affected package and version, steps to reproduce, and the impact you observed. We aim to
acknowledge reports within a few business days.

## Supported versions

Security fixes land on the latest published major of `@caatinga/cli`, `@caatinga/core`,
`@caatinga/client` and `@caatinga/zk` (check `npm view @caatinga/cli dist-tags`).

## Trust model

- **`caatinga.config.ts` is code.** `ctg` loads it with a TypeScript runtime, so running `ctg` in a
  repository you did not write executes that repository's config. Review the config of a cloned
  project before running `ctg` in it, as you would review a `package.json` script.
- **Third-party tools are pinned.** `circom` binaries are verified against pinned SHA-256 checksums,
  and `snarkjs` is installed from a committed lockfile with `npm ci --ignore-scripts`. A mismatch
  fails with `CAATINGA_ZK_CHECKSUM_MISMATCH` or an npm `EINTEGRITY` error. Treat either as a possible
  supply-chain compromise, not a flaky download.
- **Signing keys stay in the Stellar CLI.** Caatinga resolves identities through `stellar keys` and
  never stores secret keys in `caatinga.artifacts.json` or generated frontend config.

## For contributors

CI runs `scripts/check-no-obfuscation.mjs` on every pull request. It rejects obfuscated or dynamically
executed code (`eval`, the `Function` constructor, encoded payloads, packed lines), hidden Unicode
(bidi and zero-width characters), dependency install hooks, non-registry dependencies, and committed
native binaries. Run `pnpm check:obfuscation` locally before opening a pull request.
