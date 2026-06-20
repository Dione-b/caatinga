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
}

export interface CaatingaContractRegistration {
  binding: unknown;
  contractId?: string;
}

export interface CaatingaClientConfig {
  network: CaatingaNetwork;
  artifacts: CaatingaArtifacts;
  wallet: CaatingaWalletAdapter;
  /** Optional timeout (ms) for wallet `getPublicKey` and `signTransaction`. No default when omitted. */
  walletTimeout?: number;
  contracts: Record<string, CaatingaContractRegistration>;
}

export type CaatingaInvokeStatus =
  | "built"
  | "prepared"
  | "signed"
  | "submitted"
  | "confirmed"
  | "failed";

export interface CaatingaInvokeOptions {
  debugXdr?: boolean;
  debugRaw?: boolean;
}

export interface CaatingaReadOptions {
  debugRaw?: boolean;
}

export interface CaatingaInvokeResult<T = unknown> {
  status: CaatingaInvokeStatus;
  contract: string;
  method: string;
  contractId: string;
  transactionHash?: string;
  result?: T;
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
  createClient(input: {
    contractId: string;
    publicKey: string;
    rpcUrl: string;
    networkPassphrase: string;
  }): unknown;

  callMethod(input: {
    client: unknown;
    method: string;
    args?: Record<string, unknown>;
  }): Promise<unknown>;
}
