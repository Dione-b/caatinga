/**
 * Shared Stellar strkey / wasm-hash patterns — the single source of truth so the
 * artifacts schema and the CLI parsers cannot drift apart.
 *
 * Stellar strkeys are RFC4648 base32, so the alphabet is A-Z2-7 — the digits 0,
 * 1, 8 and 9 never appear. A contract strkey is a `C` prefix plus 55 base32
 * characters; an account (source) strkey is a `G` prefix plus 55 base32
 * characters. `hashWasm` (and the Stellar CLI) emit the wasm hash as 64
 * lowercase hex characters.
 *
 * These values cross a trust boundary: the contractId / wasmHash read from
 * caatinga.artifacts.json flow directly into signed Stellar CLI transactions
 * (invoke / upgrade / rollback) and into generated frontend config. A wrong,
 * truncated or malicious key that only passed a non-emptiness check would be
 * signed against or shipped to the frontend, so keeping the patterns here in one
 * place stops any spot from silently accepting a malformed key.
 */

/** Base32 strkey body shared by every strkey type: 55 chars after the type prefix. */
export const STRKEY_BODY = "[A-Z2-7]{55}";

/** Anchored contract strkey (`C` prefix), e.g. `caatinga.artifacts.json` contractId. */
export const CONTRACT_ID_REGEX = new RegExp(`^C${STRKEY_BODY}$`);

/** Anchored account (source) strkey (`G` prefix), e.g. a deploy source address. */
export const STELLAR_ADDRESS_REGEX = new RegExp(`^G${STRKEY_BODY}$`);

/** wasm hash as emitted by `hashWasm` / the Stellar CLI: 64 lowercase hex chars. */
export const WASM_HASH_REGEX = /^[a-f0-9]{64}$/;
