import type { CaatingaWalletAdapter } from "../types.js";
import { withWalletTimeout } from "./with-wallet-timeout.js";

/**
 * Optional adapter capabilities the session takes advantage of when present.
 * The minimal {@link CaatingaWalletAdapter} contract stays untouched: adapters
 * that only implement `getPublicKey`/`signTransaction` (e.g. Freighter) work,
 * richer adapters (e.g. Stellar Wallets Kit) get modal-based connect, real
 * disconnect, and wallet-id persistence for free.
 */
export interface CaatingaWalletCapabilities {
  openModal?(): Promise<string>;
  disconnect?(): Promise<void>;
  setWallet?(walletId: string): void;
  getWalletId?(): string | undefined;
}

export type WalletSessionStatus = "disconnected" | "connecting" | "connected";

export interface WalletSessionState {
  status: WalletSessionStatus;
  publicKey: string | null;
  error: Error | null;
}

/** Minimal storage contract so tests and non-browser hosts can inject their own. */
export interface WalletSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WalletSessionOptions {
  /** Persist the connection across page loads so `restore()` can reconnect silently. */
  persist?: boolean;
  /** Storage backend for persistence. Defaults to `window.localStorage` when available. */
  storage?: WalletSessionStorage;
  /** Persistence key. Defaults to {@link WALLET_SESSION_STORAGE_KEY}. */
  storageKey?: string;
  /** Optional timeout (ms) applied to connect/restore wallet calls. */
  timeout?: number;
}

export interface WalletSession {
  adapter: CaatingaWalletAdapter;
  getState(): WalletSessionState;
  /** Subscribe to state transitions. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Connect via the adapter modal when available, else `getPublicKey()`. */
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  /**
   * Silent reconnect from persisted state. Resolves the public key on success,
   * `null` when nothing was persisted or reconnection failed — never rejects
   * and never sets `state.error` (no error toast on page load).
   */
  restore(): Promise<string | null>;
}

export const WALLET_SESSION_STORAGE_KEY = "caatinga:wallet-session";

interface PersistedWalletSession {
  v: 1;
  walletId?: string;
}

function defaultStorage(): WalletSessionStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    // Storage access can throw (sandboxed iframes, privacy modes).
    return undefined;
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function createWalletSession(
  adapter: CaatingaWalletAdapter,
  options: WalletSessionOptions = {}
): WalletSession {
  const capabilities = adapter as CaatingaWalletAdapter & CaatingaWalletCapabilities;
  const storage = options.persist ? (options.storage ?? defaultStorage()) : undefined;
  const storageKey = options.storageKey ?? WALLET_SESSION_STORAGE_KEY;
  const listeners = new Set<() => void>();

  let state: WalletSessionState = {
    status: "disconnected",
    publicKey: null,
    error: null,
  };

  function setState(next: WalletSessionState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function persistConnection(): void {
    if (!storage) {
      return;
    }
    const payload: PersistedWalletSession = { v: 1 };
    const walletId = capabilities.getWalletId?.();
    if (walletId) {
      payload.walletId = walletId;
    }
    try {
      storage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Quota/privacy failures must not break the connect flow.
    }
  }

  function clearPersisted(): void {
    try {
      storage?.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  function readPersisted(): PersistedWalletSession | null {
    if (!storage) {
      return null;
    }
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as PersistedWalletSession;
      return parsed && parsed.v === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  async function requestPublicKey(label: string, viaModal: boolean): Promise<string> {
    const request =
      viaModal && capabilities.openModal
        ? () => capabilities.openModal!()
        : () => adapter.getPublicKey();
    return withWalletTimeout(label, options.timeout, request);
  }

  async function connect(): Promise<string> {
    setState({ status: "connecting", publicKey: null, error: null });
    try {
      const publicKey = await requestPublicKey("connect", true);
      setState({ status: "connected", publicKey, error: null });
      persistConnection();
      return publicKey;
    } catch (error) {
      setState({ status: "disconnected", publicKey: null, error: toError(error) });
      throw error;
    }
  }

  async function disconnect(): Promise<void> {
    try {
      await capabilities.disconnect?.();
    } finally {
      clearPersisted();
      setState({ status: "disconnected", publicKey: null, error: null });
    }
  }

  async function restore(): Promise<string | null> {
    if (state.status === "connected") {
      return state.publicKey;
    }

    const persisted = readPersisted();
    if (!persisted) {
      return null;
    }

    setState({ status: "connecting", publicKey: null, error: null });
    try {
      if (persisted.walletId) {
        capabilities.setWallet?.(persisted.walletId);
      }
      const publicKey = await requestPublicKey("restore", false);
      setState({ status: "connected", publicKey, error: null });
      return publicKey;
    } catch {
      clearPersisted();
      setState({ status: "disconnected", publicKey: null, error: null });
      return null;
    }
  }

  return {
    adapter,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect,
    disconnect,
    restore,
  };
}
