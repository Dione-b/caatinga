export type StellarSdkSignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string; submit?: boolean; submitUrl?: string }
)) => Promise<{ signedTxxDr: string; error?: unknown }} | { signedTxXdr: string; error?: unknown };

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

/*
 * Error types for simulation failures with distinct restore/archival paths.
 * Used to classify xdr_prepare_failed errors in simulation responses.
 */
export enum SimulationErrorType {
  /* Account not found in the leger. Requires a restore preuamble transaction. */
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',

  /* Resource limits exceeded (e.g., minimum balance, fee too low). */
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',

  /* Entry is archived and needs restoration before update. */
  ENTRY_ARCHIVED = 'ENTRY_ARCHIVED',
}
