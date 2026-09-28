---
"@caatinga/client": patch
---

Freighter adapter now handles freighter-api v4 `{ error }` responses: a missing address throws `CAATINGA_WALLET_NOT_CONNECTED` and a failed or rejected signature throws `CAATINGA_XDR_SIGN_FAILED`, both carrying Freighter's message (#231).
