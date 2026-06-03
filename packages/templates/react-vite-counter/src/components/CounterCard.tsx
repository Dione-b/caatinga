import { useCallback, useMemo, useState } from "react";
import { caatingaClient } from "../caatinga.js";
import { CaatingaError } from "@caatinga/core/browser";

function formatCaatingaError(error: unknown): string {
  if (error instanceof CaatingaError) {
    return `[${error.code}] ${error.message}\n\n${error.hint}`;
  }

  return error instanceof Error ? error.message : String(error);
}

export function CounterCard() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formattedCount = useMemo(
    () => (count === null ? "Unknown" : new Intl.NumberFormat().format(count)),
    [count]
  );

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
