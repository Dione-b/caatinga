import type { CaatingaArtifacts } from "@caatinga/core/browser";

type ZkStatusPanelProps = {
  artifacts: CaatingaArtifacts;
  publicKey: string | null;
};

export function ZkStatusPanel({ artifacts, publicKey }: ZkStatusPanelProps) {
  const verifier = artifacts.networks?.testnet?.contracts?.verifier;
  const contractId = verifier?.contractId ?? "—";

  return (
    <section className="counter-panel" aria-labelledby="zk-status-title">
      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">ZK workflow</p>
          <h2 id="zk-status-title">Verifier on testnet</h2>
        </div>
        <span className="network-pill">testnet</span>
      </div>
      <p>
        Circuit <code>main</code> (multiplier) is configured in <code>caatinga.config.ts</code>.
        Proof generation and on-chain verification run through the CLI today; this UI tracks deploy
        status and wallet connection for upcoming client flows.
      </p>
      <dl className="zk-meta">
        <div>
          <dt>Verifier contract</dt>
          <dd>
            <code>{contractId}</code>
          </dd>
        </div>
        <div>
          <dt>Connected wallet</dt>
          <dd>{publicKey ?? "Not connected"}</dd>
        </div>
      </dl>
      <pre className="counter-error" role="note">
        {`npx caatinga zk prove main
npx caatinga zk invoke --source-account <identity>`}
      </pre>
    </section>
  );
}
