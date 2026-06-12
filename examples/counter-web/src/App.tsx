import { useState } from "react";
import { WalletProvider, useWallet } from "@caatinga/client/react";
import { caatinga } from "./caatinga.js";
import { stellarWalletAdapter } from "./wallet.js";
import "./styles.css";

type Status = {
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

function AppBody() {
  const { publicKey, connecting, error: walletError, connect } = useWallet();
  const [status, setStatus] = useState<Status>({});
  const [loading, setLoading] = useState(false);

  async function connectWallet() {
    setStatus({});
    // Connection errors surface through the hook's `error` state.
    await connect().catch(() => {});
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

  const busy = loading || connecting;
  const errorMessage = status.error ?? (walletError ? formatError(walletError) : undefined);

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
        <button type="button" onClick={connectWallet} disabled={busy}>
          Connect wallet
        </button>
        <button type="button" onClick={increment} disabled={busy || !publicKey}>
          Increment
        </button>
        <button type="button" onClick={readCounter} disabled={busy || !publicKey}>
          Read value
        </button>
      </section>

      <section className="state">
        <p>Loading: {busy ? "yes" : "no"}</p>
        <p>Public key: {publicKey ?? "not connected"}</p>
        <p>Transaction: {status.transactionHash ?? "none"}</p>
        <p>Value: {status.value ?? "unknown"}</p>
        {errorMessage ? <pre>{errorMessage}</pre> : null}
      </section>
    </main>
  );
}

export function App() {
  return (
    // persist keeps the session across reloads; the provider silently
    // reconnects on mount (autoConnect defaults to true when persisting).
    <WalletProvider adapter={stellarWalletAdapter} options={{ persist: true }}>
      <AppBody />
    </WalletProvider>
  );
}
