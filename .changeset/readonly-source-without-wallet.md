---
"@caatinga/client": minor
---

`read()` and `simulate()` work without a connected wallet. `CaatingaClientConfig.wallet` is now optional, and `CaatingaBindingAdapter.createClient` takes an optional `publicKey`.

The read source is chosen in order: the per-call `sourceAccount` option, then the wallet public key, then `readSourceAccount`, then `DEFAULT_READ_SOURCE_ACCOUNT` (the Stellar null account). That placeholder is not sent to RPC — the client omits `publicKey` so the Stellar SDK builds from its local null account instead of `getAccount`. A wallet or configured source is still loaded with `getAccount`.

Invalid `readSourceAccount` or `options.sourceAccount` values throw `CAATINGA_INVALID_CONFIG`. A single object is treated as call options only when every key is a known option (`debugRaw` / `sourceAccount` for reads, `debugXdr` / `debugRaw` for invokes); mixed objects are forwarded as contract arguments. `{ sourceAccount }` alone is options, so a method argument with that name needs the two-argument form. `CAATINGA_WALLET_TIMEOUT` and other Caatinga errors from `getPublicKey` surface on reads; `CAATINGA_WALLET_NOT_CONNECTED` and plain adapter rejections fall back to the next source.
