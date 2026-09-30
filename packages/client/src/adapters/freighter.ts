import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { getAddress, getNetworkDetails, signTransaction } from "@stellar/freighter-api";
import type { CaatingaWalletAdapter } from "../types.js";

/**
 * freighter-api v4 resolves with `{ error }` (and an empty address / XDR) instead of
 * throwing when Freighter is locked, not allowed, or the user rejects a request.
 */
export const freighterWalletAdapter: CaatingaWalletAdapter = {
  async getPublicKey() {
    const response = await getAddress();
    if (response.error || !response.address) {
      throw new CaatingaError(
        `Freighter did not return an address${response.error ? `: ${response.error.message}` : "."}`,
        CaatingaErrorCode.WALLET_NOT_CONNECTED,
        "Unlock Freighter and allow this site to access your account, then retry.",
        response.error
      );
    }
    return response.address;
  },

  async signTransaction({ xdr, networkPassphrase }) {
    const response = await signTransaction(xdr, { networkPassphrase });
    if (response.error || !response.signedTxXdr) {
      throw new CaatingaError(
        `Freighter did not sign the transaction${response.error ? `: ${response.error.message}` : "."}`,
        CaatingaErrorCode.XDR_SIGN_FAILED,
        "Approve the transaction in Freighter and check it is on the same network as the app.",
        response.error
      );
    }
    return response.signedTxXdr;
  },

  async getNetworkPassphrase() {
    const response = await getNetworkDetails();
    return response.error ? undefined : response.networkPassphrase || undefined;
  },
};
