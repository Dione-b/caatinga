export type StellarSdkSignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }> | { signedTxXdr: string };

export interface SubmitTransactionLike {
  signAndSend?: (
    input?: { signTransaction?: StellarSdkSignTransaction }
  ) => Promise<unknown> | unknown;
  send?: () => Promise<unknown> | unknown;
}

export interface SimulateTransactionLike {
  prepare?: () => Promise<unknown> | unknown;
  simulate?: (options?: { restore?: boolean }) => Promise<unknown> | unknown;
}
