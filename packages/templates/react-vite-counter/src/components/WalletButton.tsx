import { WalletNetwork, WalletType } from "../wallet.js";
import { useStellarWallet } from "../hooks/useStellarWallet.js";

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const {
    publicKey,
    selectedWallet,
    network,
    loading,
    error,
    selectWallet,
    selectNetwork,
    connect,
    disconnect
  } = useStellarWallet();

  return (
    <div className="wallet-shell">
      <div className="wallet-controls">
        <label>
          <span>Wallet</span>
          <select
            value={selectedWallet}
            onChange={(event) => void selectWallet(event.target.value as WalletType)}
          >
            <option value={WalletType.XBULL}>xBull</option>
            <option value={WalletType.FREIGHTER}>Freighter</option>
            <option value={WalletType.ALBEDO}>Albedo</option>
            <option value={WalletType.RABET}>Rabet</option>
            <option value={WalletType.WALLET_CONNECT}>WalletConnect</option>
          </select>
        </label>
        <label>
          <span>Network</span>
          <select
            value={network}
            onChange={(event) => void selectNetwork(event.target.value as WalletNetwork)}
          >
            <option value={WalletNetwork.TESTNET}>Testnet</option>
            <option value={WalletNetwork.PUBLIC}>Public</option>
          </select>
        </label>
      </div>
      <button
        className="wallet-button"
        type="button"
        onClick={publicKey ? disconnect : () => void connect()}
        disabled={loading}
        aria-live="polite"
      >
        <span className={publicKey ? "status-dot status-dot--on" : "status-dot"} />
        {loading ? "Connecting..." : publicKey ? shortenAddress(publicKey) : "Connect"}
      </button>
      {error ? (
        <p className="wallet-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
