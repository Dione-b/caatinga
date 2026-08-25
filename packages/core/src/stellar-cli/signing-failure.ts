// Single source of truth for the Stellar CLI signing-failure signature (#149).
// The 22.x "xdr value invalid" signing bug surfaces identically on both the
// invoke and the deploy paths; keeping one pattern means the invoke guard and
// the deploy-recovery trigger can never silently disagree on what matches.
export const XDR_SIGNING_FAILURE_REGEX = /xdr processing error: xdr value invalid/i;
