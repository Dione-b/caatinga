import { useWallet } from "@caatinga/client/react";
import { WALLET_SELECTION_CLOSED_ERROR } from "../wallet-modal-controller.js";

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { publicKey, connecting, error, connect, disconnect } = useWallet();

  return (
    <div className="wallet-shell">
      <button
        className="wallet-button"
        type="button"
        onClick={publicKey ? () => void disconnect() : () => void connect().catch(() => {})}
        disabled={connecting}
        aria-live="polite"
      >
        <span className={publicKey ? "status-dot status-dot--on" : "status-dot"} />
        {connecting ? "Connecting..." : publicKey ? shortenAddress(publicKey) : "Connect"}
      </button>
      {error && error.name !== WALLET_SELECTION_CLOSED_ERROR ? (
        <p className="wallet-error" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
