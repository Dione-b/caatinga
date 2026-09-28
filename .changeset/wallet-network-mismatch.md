---
"@caatinga/core": minor
"@caatinga/client": minor
---

New `CAATINGA_WALLET_NETWORK_MISMATCH`: wallet adapters may implement optional `getNetworkPassphrase()`, and `invoke()` fails fast before building/signing when the wallet is on another network than the app. The Freighter and Stellar Wallets Kit adapters implement it; wallets that cannot report their network are not blocked (#230).
