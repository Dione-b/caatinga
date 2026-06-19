export type StellarSdkSignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string; submit?: boolean; submitUrl?: string }
) => Promise<{ signedTxXdr: string; error?: unknown }> | { signedTxXdr: string; error?: unknown };

export interface SubmitTransactionLike {
  signAndSend?: (input?: {
    force?: boolean;
    signTransaction?: StellarSdkSignTransaction;
    watcher?: unknown;
  }) => Promise<unknown> | unknown;
  send?: () => Promise<unknown> | unknown;
}

export interface SimulateTransactionLike {
  prepare?: () => Promise<unknown> | unknown;
  simulate?: (options?: { restore?: boolean }) => Promise<unknown> | unknown;
}
