import { useCallback, useEffect, useMemo, useState } from "react";
import { buildVerifyProofBindingArgs } from "@caatinga/zk/browser";
import { formatCaatingaError } from "@caatinga/core/browser";
import { useWallet } from "@caatinga/client/react";
import { caatingaClient } from "../caatinga.js";
import { LoadingModal } from "./LoadingModal.js";
import { fetchZkProofBundle, ZkArtifactsError } from "../zk/fetch-artifacts.js";
import { toBindingVerifyProofArgs } from "../zk/binding-args.js";

function multiplySignals(a: string, b: string): string {
  return (BigInt(a) * BigInt(b)).toString();
}

function isValidSignal(value: string): boolean {
  return value.trim().length > 0 && /^-?\d+$/.test(value.trim());
}

export function CircuitCard() {
  const { publicKey } = useWallet();
  const [a, setA] = useState("3");
  const [b, setB] = useState("11");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [artifactsReady, setArtifactsReady] = useState<boolean | null>(null);

  const expectedOutput = useMemo(() => {
    if (!isValidSignal(a) || !isValidSignal(b)) {
      return "—";
    }

    try {
      return multiplySignals(a.trim(), b.trim());
    } catch {
      return "—";
    }
  }, [a, b]);

  const refreshArtifactsStatus = useCallback(async () => {
    try {
      await fetchZkProofBundle();
      setArtifactsReady(true);
    } catch {
      setArtifactsReady(false);
    }
  }, []);

  useEffect(() => {
    void refreshArtifactsStatus();
  }, [refreshArtifactsStatus]);

  function downloadInputJson() {
    setError(null);

    if (!isValidSignal(a) || !isValidSignal(b)) {
      setError("Enter valid integer values for a and b.");
      return;
    }

    const payload = JSON.stringify({ a: a.trim(), b: b.trim() }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "input.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function verifyProof() {
    if (!publicKey) {
      setError("Connect a wallet before verifying on-chain.");
      return;
    }

    setLoading(true);
    setError(null);
    setVerified(null);

    try {
      const { proof, vk, publicSignals } = await fetchZkProofBundle();
      const bindingArgs = toBindingVerifyProofArgs(
        buildVerifyProofBindingArgs({ proof, vk, publicSignals })
      );
      const result = await caatingaClient
        .contract("verifier")
        .read<boolean>("verify_proof", bindingArgs);

      setVerified(result === true);
      setArtifactsReady(true);
    } catch (caught) {
      if (caught instanceof ZkArtifactsError) {
        setArtifactsReady(false);
      }
      setError(formatCaatingaError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="counter-panel" aria-labelledby="circuit-title">
      {loading ? <LoadingModal label="Verifying proof…" /> : null}

      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">Multiplier circuit</p>
          <h2 id="circuit-title">Groth16 proof</h2>
        </div>
        <span className="network-pill">testnet</span>
      </div>

      <p>
        Set private inputs, download <code>input.json</code>, run <code>npx ctg zk prove main</code>
        , then verify the proof on-chain with your wallet.
      </p>

      <div className="zk-form">
        <label>
          <span>a</span>
          <input value={a} onChange={(event) => setA(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          <span>b</span>
          <input value={b} onChange={(event) => setB(event.target.value)} inputMode="numeric" />
        </label>
        <div className="zk-form__preview">
          <span className="eyebrow">Expected public output</span>
          <strong>c = {expectedOutput}</strong>
        </div>
      </div>

      <div className="counter-actions">
        <button type="button" onClick={downloadInputJson} disabled={loading}>
          Download input.json
        </button>
        <button type="button" onClick={() => void verifyProof()} disabled={loading || !publicKey}>
          {loading ? "Verifying…" : "Verify proof on-chain"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void refreshArtifactsStatus()}
          disabled={loading}
        >
          Refresh artifacts
        </button>
      </div>

      {artifactsReady === false ? (
        <pre className="counter-error" role="note">
          {`Proof artifacts are missing from .artifacts/zk/main/.
Run:
npm run caatinga:zk:setup
Then refresh artifacts and verify again.`}
        </pre>
      ) : null}

      {verified === true ? (
        <p className="zk-success" role="status">
          Proof verified on-chain.
        </p>
      ) : verified === false ? (
        <p className="counter-error" role="status">
          Proof verification failed on-chain. Check that circuits/input.json matches the downloaded
          values and re-run <code>npx ctg zk prove main</code>.
        </p>
      ) : null}

      {error ? (
        <pre className="counter-error" role="alert">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
