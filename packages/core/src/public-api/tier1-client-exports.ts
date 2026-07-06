/**
 * Tier 1 supported exports from @caatinga/client (v1.0 contract).
 * Keep in sync with docs/public-api.md and packages/client/src/index.ts.
 */
export const TIER1_CLIENT_ROOT_EXPORTS = [
  "CaatingaBindingAdapter",
  "CaatingaClientConfig",
  "CaatingaContractClient",
  "CaatingaContractRegistration",
  "CaatingaInvokeOptions",
  "CaatingaInvokeResult",
  "CaatingaInvokeStatus",
  "CaatingaNetwork",
  "CaatingaReadOptions",
  "CaatingaReadResult",
  "CaatingaWalletAdapter",
  "CaatingaWalletCapabilities",
  "CaatingaXdrBuildResult",
  "WALLET_SESSION_STORAGE_KEY",
  "WalletSession",
  "WalletSessionOptions",
  "WalletSessionState",
  "WalletSessionStatus",
  "WalletSessionStorage",
  "buildXdr",
  "createCaatingaClient",
  "createDefaultBindingAdapter",
  "createWalletSession",
  "resolveContractId",
] as const;

export const TIER1_CLIENT_PACKAGE_EXPORTS = [
  ".",
  "./freighter",
  "./react",
  "./stellar-wallets-kit",
  "./vite",
] as const;
