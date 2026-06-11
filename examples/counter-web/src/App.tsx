import { useState } from "react";
import { caatinga } from "./caatinga.js";
import { stellarWalletAdapter } from "./wallet.js";
import "./styles.css";

type Status = {
  publicKey?: string;
  value?: string;
  transactionHash?: string;
  error?: string;
};

function formatError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("CAATINGA_")
  ) {
    const candidate = error as { code: string; message?: string; hint?: string; cause?: unknown };
    const base = `[${candidate.code}] ${candidate.message ?? "Caatinga error"}\n\nFix:\n${candidate.hint ?? "Check the failing operation and retry."}`;
    const cause = candidate.cause;
    if (cause !== undefined && cause !== null) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      if (detail) return `${base}\n\nDetails: ${detail}`;
    }
    return base;
  }

  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const [status, setStatus] = useState<Status>({});
  const [loading, setLoading] = useState(false);

  async function connectWallet() {
    setLoading(true);
    setStatus({});
    try {
      // Lists only installed/available wallets and resolves with the address.
      const publicKey = await stellarWalletAdapter.openModal();
      setStatus({ publicKey });
    } catch (error) {
      setStatus({ error: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  async function increment() {
    setLoading(true);
    setStatus((current) => ({ ...current, error: undefined }));
    try {
      const result = await caatinga.contract("counter").invoke<number>("increment", {
        debugXdr: true
      });
      const value = result.result ?? await caatinga.contract("counter").read<number>("get");
      setStatus((current) => ({
        ...current,
        transactionHash: result.transactionHash ?? "submitted",
        value: JSON.stringify(value)
      }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: formatError(error) }));
    } finally {
      setLoading(false);
    }
  }

  async function readCounter() {
    setLoading(true);
    setStatus((current) => ({ ...current, error: undefined }));
    try {
      const result = await caatinga.contract("counter").read("get");
      setStatus((current) => ({
        ...current,
        value: JSON.stringify(result)
      }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: formatError(error) }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Caatinga example</p>
        <h1>Counter Web</h1>
        <p>
          Minimal Vite + React example showing `@caatinga/client`, generated bindings,
          artifacts, and a Stellar Wallets Kit adapter in one browser flow.
        </p>
      </section>

      <section className="panel">
        <button type="button" onClick={connectWallet} disabled={loading}>
          Connect wallet
        </button>
        <button type="button" onClick={increment} disabled={loading || !status.publicKey}>
          Increment
        </button>
        <button type="button" onClick={readCounter} disabled={loading || !status.publicKey}>
          Read value
        </button>
      </section>

      <section className="state">
        <p>Loading: {loading ? "yes" : "no"}</p>
        <p>Public key: {status.publicKey ?? "not connected"}</p>
        <p>Transaction: {status.transactionHash ?? "none"}</p>
        <p>Value: {status.value ?? "unknown"}</p>
        {status.error ? <pre>{status.error}</pre> : null}
      </section>
    </main>
  );
}
