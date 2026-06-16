export function ContractNotDeployed() {
  return (
    <section className="counter-panel" aria-labelledby="not-deployed-title">
      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">Get started</p>
          <h2 id="not-deployed-title">Verifier not deployed</h2>
        </div>
        <span className="network-pill">testnet</span>
      </div>
      <p>
        The Groth16 verifier has no on-chain ID yet. Build and deploy first — the dApp reads the contract
        ID from <code>caatinga.artifacts.json</code>. Deploy also generates TypeScript bindings automatically.
      </p>
      <pre className="counter-error" role="note">
        {`npx caatinga build verifier
npx caatinga zk build main
npx caatinga deploy verifier --network testnet --source <identity>
npx caatinga generate verifier --network testnet
npm run dev`}
      </pre>
    </section>
  );
}
