// Intentionally plain .ts with createElement (no JSX) so the client package
// needs no jsx compiler option and stays consumable from any React setup.
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode
} from "react";
import type { CaatingaWalletAdapter } from "../types.js";
import {
  createWalletSession,
  type WalletSession,
  type WalletSessionOptions,
  type WalletSessionState
} from "../wallet/wallet-session.js";

const WalletSessionContext = createContext<WalletSession | null>(null);

export interface WalletProviderProps {
  /** Adapter the provider wraps in a session. Ignored when `session` is given. */
  adapter?: CaatingaWalletAdapter;
  /** Pre-built session (e.g. shared with non-React code). Takes precedence over `adapter`. */
  session?: WalletSession;
  /** Session options applied when the provider creates the session from `adapter`. */
  options?: WalletSessionOptions;
  /**
   * Run `session.restore()` on mount for silent reconnect.
   * Defaults to true when persistence is enabled, false otherwise.
   */
  autoConnect?: boolean;
  children?: ReactNode;
}

export function WalletProvider(props: WalletProviderProps): ReactElement {
  const { adapter, session: providedSession, autoConnect, children } = props;

  // Session creation must run once: options are captured on first render so an
  // inline `options={{...}}` literal cannot recreate the session every render.
  const initialOptions = useRef(props.options);
  const session = useMemo(() => {
    if (providedSession) {
      return providedSession;
    }
    if (!adapter) {
      throw new Error("WalletProvider requires an `adapter` or a `session` prop.");
    }
    return createWalletSession(adapter, initialOptions.current);
  }, [providedSession, adapter]);

  const shouldAutoConnect = autoConnect ?? initialOptions.current?.persist ?? false;
  const restoredFor = useRef<WalletSession | null>(null);
  useEffect(() => {
    if (!shouldAutoConnect || restoredFor.current === session) {
      return;
    }
    restoredFor.current = session;
    void session.restore();
  }, [session, shouldAutoConnect]);

  return createElement(WalletSessionContext.Provider, { value: session }, children);
}

export function useWalletSession(): WalletSession {
  const session = useContext(WalletSessionContext);
  if (!session) {
    throw new Error("useWalletSession must be used within a <WalletProvider>.");
  }
  return session;
}

export interface UseWalletResult extends WalletSessionState {
  connected: boolean;
  connecting: boolean;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  session: WalletSession;
}

export function useWallet(): UseWalletResult {
  const session = useWalletSession();
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);

  return useMemo(
    () => ({
      ...state,
      connected: state.status === "connected",
      connecting: state.status === "connecting",
      connect: session.connect,
      disconnect: session.disconnect,
      session
    }),
    [session, state]
  );
}
