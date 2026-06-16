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
        The Groth16 verifier has no on-chain ID yet. Build the Soroban contract, run the Circom
        trusted setup, deploy, then prove and invoke from the CLI. The frontend reads the contract
        ID from <code>caatinga.artifacts.json</code> after deploy.
      </p>
      <pre className="counter-error" role="note">
        {`npm install
npx caatinga build verifier
npx caatinga zk build main
npx caatinga deploy verifier --network testnet --source <identity>
npx caatinga zk prove main
npx caatinga zk invoke --source-account <identity>
npm run dev

# If bindings generation failed after deploy:
npx caatinga generate verifier --network testnet`}
      </pre>
    </section>
  );
}
