---
"@caatinga/core": minor
"@caatinga/cli": patch
---

`frontend.env` accepts a `network` source key (writes the resolved network name). The `react-vite-counter` and `zk-starter` templates now read network name, RPC and passphrase from `VITE_CAATINGA_*` (written to `.env.local` by `ctg deploy` / `ctg sync-env`) for the client, the wallet network and the artifacts lookup, defaulting to testnet when unset (#229).
