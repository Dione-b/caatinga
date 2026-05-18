import { freighterWalletAdapter } from "@caatinga/client/freighter";
import { useState } from "react";
import { CaatingaError } from "@caatinga/core/browser";

function formatWalletError(error: unknown): string {
  if (error instanceof CaatingaError) {
    return `[${error.code}] ${error.message}`;
  }

  return error instanceof Error ? error.message : String(error);
}

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    setError(null);

    try {
      const key = await freighterWalletAdapter.getPublicKey();
      setPublicKey(key);
    } catch (caught) {
      setPublicKey(null);
      setError(formatWalletError(caught));
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setPublicKey(null);
    setError(null);
  }

  return (
    <div className="wallet-shell">
      <button
        className="wallet-button"
        type="button"
        onClick={publicKey ? disconnect : connect}
        disabled={loading}
        aria-live="polite"
      >
        <span className={publicKey ? "status-dot status-dot--on" : "status-dot"} />
        {loading ? "Connecting…" : publicKey ? shortenAddress(publicKey) : "Connect"}
      </button>
      {error ? (
        <p className="wallet-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
