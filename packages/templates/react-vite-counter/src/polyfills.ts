// Browser polyfills, loaded before anything else (see main.tsx).
//
// `@stellar/stellar-sdk` and `@creit.tech/stellar-wallets-kit` expect Node's
// `Buffer` global, which browsers don't provide. Without this, signing or
// connecting a wallet fails at runtime with "Buffer is not defined". The
// `buffer` package is a direct dependency precisely to back this polyfill.
import { Buffer } from "buffer";

const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}
