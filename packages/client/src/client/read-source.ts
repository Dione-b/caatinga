import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";

/**
 * `G…` Ed25519 public key StrKey: `G` plus 55 base32 characters (A–Z and 2–7).
 *
 * Mirrors `StrKey.isValidEd25519PublicKey()` from `@stellar/stellar-sdk`, which the client
 * cannot import at runtime: the SDK is the app's dependency (generated bindings), not this
 * package's.
 */
const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;

/**
 * Treats empty and whitespace-only values as "not provided". Without this, `publicKey: ""`
 * reaches the SDK/RPC as a present-but-empty account and fails with an error that does not
 * name the option that was wrong. Other values are trimmed and returned unchanged.
 */
export function normalizeReadSourceAccount(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Validates a user-supplied read source account before it becomes the SDK `publicKey`,
 * where an invalid value otherwise fails deep inside the SDK with an opaque message.
 * Throws `CAATINGA_INVALID_CONFIG` naming the option that held the bad value.
 */
export function assertReadSourceAccount(value: string, origin: string): string {
  if (STELLAR_PUBLIC_KEY_PATTERN.test(value)) {
    return value;
  }

  throw new CaatingaError(
    `Invalid read source account in ${origin}: "${value}".`,
    CaatingaErrorCode.INVALID_CONFIG,
    "Use a 56-character G… Ed25519 public key, or omit it so the client uses the Stellar null account."
  );
}
