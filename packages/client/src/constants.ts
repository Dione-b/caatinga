/**
 * Canonical placeholder source account for read-only contract calls and simulations
 * when no wallet is connected and no `readSourceAccount` is configured: the Stellar
 * null account (32 zero bytes encoded as an Ed25519 public key StrKey).
 *
 * Caatinga never sends this StrKey to the RPC. The client omits `publicKey` when the
 * resolved source is this placeholder, so `@stellar/stellar-sdk` builds the transaction
 * with its local `new Account(NULL_ACCOUNT, "0")` instead of calling
 * `Server.getAccount("<null account>")` — that lookup fails on networks where the null
 * account was never funded.
 */
export const DEFAULT_READ_SOURCE_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
