import { useWallet } from "../context/WalletContext.js";

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { publicKey, loading, error, connect, disconnect } = useWallet();

  return (
    <div className="wallet-shell">
      <button
        className="wallet-button"
        type="button"
        onClick={publicKey ? () => void disconnect() : () => void connect()}
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
