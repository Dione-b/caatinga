export function ContractNotDeployed() {
  return (
    <section className="counter-panel" aria-labelledby="not-deployed-title">
      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">Get started</p>
          <h2 id="not-deployed-title">Contract not deployed</h2>
        </div>
        <span className="network-pill">testnet</span>
      </div>
      <p>
        The counter contract has no on-chain ID yet, so the frontend can&apos;t read or update it.
        Build and deploy first — the dApp reads the contract ID from{" "}
        <code>caatinga.artifacts.json</code>. Deploy also generates TypeScript bindings
        automatically.
      </p>
      <pre className="counter-error" role="note">
        {`npx ctg build    counter
npx ctg deploy   counter --network testnet --source <identity>
npm run dev

# If bindings generation failed after deploy:
npx ctg generate counter --network testnet`}
      </pre>
    </section>
  );
}
