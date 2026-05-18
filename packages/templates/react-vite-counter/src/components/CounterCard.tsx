import { useMemo, useState } from "react";
import { caatingaClient } from "../caatinga.js";
import { CaatingaError } from "@caatinga/core/browser";

function formatCaatingaError(error: unknown): string {
  if (error instanceof CaatingaError) {
    return `[${error.code}] ${error.message}\n\n${error.hint}`;
  }

  return error instanceof Error ? error.message : String(error);
}

export function CounterCard() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formattedCount = useMemo(() => new Intl.NumberFormat().format(count), [count]);

  async function increment() {
    setLoading(true);
    setError(null);

    try {
      await caatingaClient.contract("counter").invoke("increment");
      setCount((value) => value + 1);
    } catch (caught) {
      setError(formatCaatingaError(caught));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCount(0);
    setError(null);
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
        <button className="secondary-button" type="button" onClick={reset} disabled={loading}>
          Reset
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
