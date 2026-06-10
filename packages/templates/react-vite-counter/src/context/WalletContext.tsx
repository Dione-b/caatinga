import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { stellarWalletAdapter } from "../wallet.js";

interface WalletContextValue {
  publicKey: string | null;
  loading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // openModal lists only installed/available wallets and resolves with the
      // chosen account address (rejects if the user dismisses the modal).
      const address = await stellarWalletAdapter.openModal();
      setPublicKey(address);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await stellarWalletAdapter.disconnect();
    setPublicKey(null);
    setError(null);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ publicKey, loading, error, connect, disconnect }),
    [publicKey, loading, error, connect, disconnect]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }

  return context;
}
