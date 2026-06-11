import { useCallback, useEffect, useMemo, useState } from "react";
import { caatingaClient } from "../caatinga.js";
import { formatCaatingaError } from "@caatinga/core/browser";
import { useWallet } from "../context/WalletContext.js";
import { LoadingModal } from "./LoadingModal.js";

export function CounterCard() {
  const { publicKey } = useWallet();
  const [count, setCount] = useState<number | null>(null);
  // Start in the loading state: the component only mounts once a wallet is
  // connected, and it fetches immediately — so the first paint should read as
  // "Loading…" instead of flashing "Not loaded" while the read resolves.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const formattedCount = useMemo(() => {
    if (count !== null) {
      return new Intl.NumberFormat().format(count);
    }

    // While loading, the LoadingModal overlay covers this; show a neutral
    // placeholder (not "Not loaded") so nothing flashes behind it.
    return loading ? "—" : "Not loaded";
  }, [count, loading]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextCount = await caatingaClient.contract("counter").read<number>("get");
      setCount(nextCount);
    } catch (caught) {
      setError(formatCaatingaError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reads route through the wallet for the source account, so only fetch once
    // a wallet is connected. Avoids the "Not loaded" state firing before connect.
    if (!publicKey) {
      setCount(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [publicKey, refresh]);

  async function increment() {
    setLoading(true);
    setError(null);

    try {
      const result = await caatingaClient.contract("counter").invoke<number>("increment");
      if (typeof result.result === "number") {
        setCount(result.result);
      } else {
        await refresh();
      }
    } catch (caught) {
      setError(formatCaatingaError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="counter-panel" aria-labelledby="counter-title">
      {loading ? <LoadingModal label={count === null ? "Loading…" : "Updating…"} /> : null}

      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">Counter Contract</p>
          <h2 id="counter-title">Counter</h2>
        </div>
        <span className="network-pill">testnet</span>
      </div>

      <div className="counter-value">{formattedCount}</div>

      <div className="counter-actions">
        <button type="button" onClick={increment} disabled={loading}>
          {loading ? "Incrementing…" : "Increment"}
        </button>
        <button className="secondary-button" type="button" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? (
        <pre className="counter-error" role="alert">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
