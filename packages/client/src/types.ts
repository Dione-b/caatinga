import type { CaatingaArtifacts } from "@caatinga/core/browser";

export interface CaatingaNetwork {
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
}

/**
 * Wallet integration for browser-side signing.
 *
 * Implementations must reject the returned promise when the user dismisses or
 * cancels signing (do not leave the promise pending indefinitely). Adapters may
 * apply their own timeout. Caatinga optionally enforces {@link CaatingaClientConfig.walletTimeout}.
 */
export interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;
  signTransaction(input: { xdr: string; networkPassphrase: string }): Promise<string>;
  /**
   * Passphrase of the network the wallet is currently on, or `undefined` when the
   * wallet cannot report it. When provided, `invoke` refuses to sign if it differs
   * from `config.network.networkPassphrase` (`CAATINGA_WALLET_NETWORK_MISMATCH`).
   */
  getNetworkPassphrase?(): Promise<string | undefined>;
}

export interface CaatingaContractRegistration {
  binding: unknown;
  contractId?: string;
}

export interface CaatingaClientConfig {
  network: CaatingaNetwork;
  artifacts: CaatingaArtifacts;
  /**
   * Wallet integration for signing transactions. Optional: `simulate()` and `read()`
   * work without a wallet by falling back to {@link readSourceAccount}. `invoke()` and
   * `buildXdr()` require a wallet and throw `CAATINGA_WALLET_NOT_CONNECTED` without one.
   */
  wallet?: CaatingaWalletAdapter;
  /** Optional timeout (ms) for wallet `getPublicKey` and `signTransaction`. No default when omitted. */
  walletTimeout?: number;
  contracts: Record<string, CaatingaContractRegistration>;
  /**
   * Source account for `simulate()` and `read()` when no wallet public key is available
   * (no wallet configured, disconnected, locked, or an empty address).
   *
   * Must be a `G…` Ed25519 public key StrKey; any other value throws
   * `CAATINGA_INVALID_CONFIG` before the RPC call. Defaults to
   * `DEFAULT_READ_SOURCE_ACCOUNT` (the Stellar null account), which the client turns into
   * an SDK-local source account instead of an RPC lookup.
   */
  readSourceAccount?: string;
}

/**
 * Terminal states after submission are read from the transaction's on-chain
 * outcome: `confirmed` only on `SUCCESS`, `failed` on `FAILED`/`ERROR`, and
 * `pending` when the outcome is genuinely unresolved. `pending` is not success —
 * see docs/runtime-invoke-pipeline.md for the full RPC status mapping.
 */
export type CaatingaInvokeStatus =
  | "built"
  | "prepared"
  | "signed"
  | "submitted"
  | "pending"
  | "confirmed"
  | "failed";

export interface CaatingaInvokeOptions {
  debugXdr?: boolean;
  debugRaw?: boolean;
  /** Allow a compatible generated binding to restore archived Soroban state before invocation. */
  restore?: boolean;
}

export interface CaatingaReadOptions {
  debugRaw?: boolean;
  /**
   * Source account override for this call. Takes precedence over the connected wallet,
   * over {@link CaatingaClientConfig.readSourceAccount}, and over the default
   * placeholder.
   *
   * Must be a `G…` Ed25519 public key StrKey; any other value throws
   * `CAATINGA_INVALID_CONFIG` before the RPC call. Pass options as the second argument
   * when the method also takes args (`simulate("balance", { id }, { sourceAccount })`):
   * a single object is only treated as options when every key is `debugRaw` or
   * `sourceAccount`.
   */
  sourceAccount?: string;
}

export interface CaatingaInvokeResult<T = unknown> {
  status: CaatingaInvokeStatus;
  contract: string;
  method: string;
  contractId: string;
  transactionHash?: string;
  result?: T;
  /** Raw result XDR from the RPC, present on `failed` when it returned one. */
  resultXdr?: string;
  /** Soroban diagnostic events from the RPC, present on `failed` when returned. */
  diagnosticEvents?: unknown[];
  xdr?: {
    unsigned?: string;
    prepared?: string;
    signed?: string;
  };
  raw?: unknown;
}

export interface CaatingaReadResult<T = unknown> {
  status: "simulated";
  contract: string;
  method: string;
  contractId: string;
  result: T;
  raw?: unknown;
}

export interface CaatingaXdrBuildResult {
  contract: string;
  method: string;
  contractId: string;
  unsignedXdr?: string;
  preparedXdr: string;
  raw?: unknown;
}

export interface CaatingaBindingAdapter {
  /**
   * Builds the generated binding client. `publicKey` is omitted for calls without a
   * source account (wallet-less reads): generated bindings then use the SDK's local null
   * account instead of fetching it from the RPC, so reads work on unfunded networks.
   */
  createClient(input: {
    contractId: string;
    publicKey?: string;
    rpcUrl: string;
    networkPassphrase: string;
  }): unknown;

  callMethod(input: {
    client: unknown;
    method: string;
    args?: Record<string, unknown>;
    /** Generated binding method options, such as `restore` and its signer callback. */
    methodOptions?: Record<string, unknown>;
  }): Promise<unknown>;
}
