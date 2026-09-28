import { appNetwork } from "../network.js";

export function ContractNotDeployed() {
  return (
    <section className="counter-panel" aria-labelledby="not-deployed-title">
      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">Get started</p>
          <h2 id="not-deployed-title">Verifier not deployed</h2>
        </div>
        <span className="network-pill">{appNetwork.name}</span>
      </div>
      <p>
        The Groth16 verifier has no on-chain ID yet. Build and deploy first — the dApp reads the
        contract ID from <code>caatinga.artifacts.json</code>. Deploy also generates TypeScript
        bindings automatically.
      </p>
      <pre className="counter-error" role="note">
        {`npx ctg build verifier
npx ctg zk build main
npx ctg deploy verifier --network ${appNetwork.name} --source <identity>
npx ctg generate verifier --network ${appNetwork.name}
npm run dev`}
      </pre>
    </section>
  );
}
