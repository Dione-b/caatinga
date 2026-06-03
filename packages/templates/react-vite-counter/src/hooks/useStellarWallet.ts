import { useCallback, useEffect, useState } from "react";
import { stellarWalletAdapter, WalletNetwork, WalletType } from "../wallet.js";

export function useStellarWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletType>(WalletType.XBULL);
  const [network, setNetwork] = useState<WalletNetwork>(WalletNetwork.TESTNET);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectWallet = useCallback(async (wallet: WalletType) => {
    setError(null);
    await stellarWalletAdapter.setWallet(wallet);
    setSelectedWallet(wallet);
    setPublicKey(null);
  }, []);

  const selectNetwork = useCallback(async (nextNetwork: WalletNetwork) => {
    setError(null);
    await stellarWalletAdapter.setNetwork(nextNetwork);
    setNetwork(nextNetwork);
    setPublicKey(null);
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (selectedWallet === WalletType.WALLET_CONNECT) {
        await stellarWalletAdapter.startWalletConnect();
        await stellarWalletAdapter.connectWalletConnect();
      }

      const key = await stellarWalletAdapter.getPublicKey();
      setPublicKey(key);
      return key;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setPublicKey(null);
      setError(message);
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [selectedWallet]);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setError(null);
  }, []);

  useEffect(() => {
    stellarWalletAdapter.onWalletConnectSessionDeleted(() => {
      setPublicKey(null);
    });
  }, []);

  return {
    publicKey,
    selectedWallet,
    network,
    loading,
    error,
    selectWallet,
    selectNetwork,
    connect,
    disconnect
  };
}
