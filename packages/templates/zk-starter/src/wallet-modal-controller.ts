// Promise bridge between the wallet adapter's `openModal()` capability and the
// <WalletModal> component. The adapter resolves the same promise the wallet
// session awaits, so connect/persist/restore flows stay untouched.

export interface WalletModalState {
  open: boolean;
}

/**
 * `error.name` used when the user closes the modal without picking a wallet.
 * Closing on purpose is not a failure, so the UI can suppress this one.
 */
export const WALLET_SELECTION_CLOSED_ERROR = "WalletSelectionClosedError";

interface PendingSelection {
  resolve(address: string): void;
  reject(error: Error): void;
}

let state: WalletModalState = { open: false };
let pending: PendingSelection | null = null;
const listeners = new Set<() => void>();

function setState(next: WalletModalState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getWalletModalState(): WalletModalState {
  return state;
}

export function subscribeWalletModal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Opens the modal. Resolves with the connected address, rejects when closed. */
export function requestWalletSelection(): Promise<string> {
  // A connect while the modal is already open supersedes the previous request.
  cancelWalletSelection();

  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject };
    setState({ open: true });
  });
}

export function resolveWalletSelection(address: string): void {
  const current = pending;
  pending = null;
  if (state.open) {
    setState({ open: false });
  }
  current?.resolve(address);
}

export function cancelWalletSelection(): void {
  const current = pending;
  pending = null;
  if (state.open) {
    setState({ open: false });
  }
  if (current) {
    const error = new Error("Wallet selection closed.");
    error.name = WALLET_SELECTION_CLOSED_ERROR;
    current.reject(error);
  }
}
