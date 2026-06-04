---
"@caatinga/cli": patch
---

fix: unblock `caatinga init react-vite-counter` builds

`stellar-wallets-kit`'s `xbull.js` imports `@creit-tech/xbull-wallet-connect` (hyphen, GitHub tarball variant, which ships `src/index.ts`). The template's `vite.config.ts` resolved the package directory using the npm-published `@creit.tech/xbull-wallet-connect` (dot) instead, so the alias pointed to a non-existent `src/index.ts` inside a directory without a `src/` folder. Vite's `load-fallback` then failed at `vite build`.

The template now resolves the same hyphen-named package that `stellar-wallets-kit` actually imports, so the alias targets the correct `src/index.ts` file.
