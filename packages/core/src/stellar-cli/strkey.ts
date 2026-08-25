// Single source of truth for the Stellar account (public-key) strkey shape.
// Previously this regex was copy-pasted in three places (resolve-method-args,
// resolve-source-address, recover-deploy-contract-id) and source validation
// reached into the deploy-recovery module just to borrow it (#148). Centralizing
// it here removes the divergence risk and the cross-module coupling.

/** Stellar account (public-key) strkey: `G` followed by 55 base32 `[A-Z2-7]` chars. */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/** True when `source` is a raw Stellar public key rather than a named alias. */
export function isLikelyPublicKeySource(source: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(source);
}
