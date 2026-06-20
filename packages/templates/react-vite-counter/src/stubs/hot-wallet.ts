// Stub for @hot-wallet/sdk. Stellar Wallets Kit pulls this NEAR-ecosystem SDK
// (via its HOT Wallet module) into every import, dragging @near-js/crypto and
// randombytes — Node-only code that references `global` and crashes in the
// browser. The Caatinga adapter filters HOT Wallet out of the wallet list, so
// this SDK is never actually used; aliasing it here (see vite.config.ts) keeps
// the NEAR chain out of the bundle entirely.
//
// `HOT` is only referenced inside HotWalletModule methods, which are never
// reached, so a throwing stub is safe.
export const HOT = {
  request(): Promise<never> {
    return Promise.reject(new Error("HOT Wallet is not supported in this build."));
  },
};
