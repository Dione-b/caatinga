import { useState } from "react";
import { caatinga } from "./caatinga.js";
import { stellarWalletAdapter, WalletNetwork, WalletType } from "./wallet.js";
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
    const candidate = error as { code: string; message?: string; hint?: string };
    return `[${candidate.code}] ${candidate.message ?? "Caatinga error"}\n\nFix:\n${candidate.hint ?? "Check the failing operation and retry."}`;
  }

  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const [status, setStatus] = useState<Status>({});
  const [loading, setLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType>(WalletType.XBULL);
  const [network, setNetwork] = useState<WalletNetwork>(WalletNetwork.TESTNET);

  async function selectWallet(wallet: WalletType) {
    setSelectedWallet(wallet);
    setStatus({});
    await stellarWalletAdapter.setWallet(wallet);
  }

  async function selectNetwork(nextNetwork: WalletNetwork) {
    setNetwork(nextNetwork);
    setStatus({});
    await stellarWalletAdapter.setNetwork(nextNetwork);
  }

  async function connectWallet() {
    setLoading(true);
    setStatus({});
    try {
      if (selectedWallet === WalletType.WALLET_CONNECT) {
        await stellarWalletAdapter.startWalletConnect();
        await stellarWalletAdapter.connectWalletConnect();
      }

      const publicKey = await stellarWalletAdapter.getPublicKey();
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
        <button type="button" onClick={connectWallet} disabled={loading}>
          Connect wallet
        </button>
        <button type="button" onClick={increment} disabled={loading}>
          Increment
        </button>
        <button type="button" onClick={readCounter} disabled={loading}>
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
