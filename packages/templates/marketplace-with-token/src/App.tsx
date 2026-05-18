const deploySteps = [
  "Build token and marketplace contracts",
  "Deploy token first so artifacts capture its contractId",
  "Deploy marketplace and inject tokenContractId via __constructor",
  "Generate bindings for both contracts"
];

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Caatinga Multi-Contract</p>
        <h1>__PROJECT_NAME__</h1>
        <p className="lede">
          Official demo template for dependency-ordered deploys where the marketplace constructor
          receives the deployed token contract ID.
        </p>
      </header>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Contracts</p>
            <h2>Deployment graph</h2>
          </div>
          <span className="network-pill">testnet</span>
        </div>

        <div className="graph">
          <article className="graph-card">
            <p className="graph-card__label">Root contract</p>
            <h3>token</h3>
            <p>Deploys first and publishes its contract ID into local artifacts.</p>
          </article>
          <article className="graph-card graph-card--dependent">
            <p className="graph-card__label">Dependent contract</p>
            <h3>marketplace</h3>
            <p>
              Receives <code>tokenContractId</code> through <code>deployArgs</code> mapped to the
              contract <code>__constructor</code>.
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Flow</p>
        <h2>What this template proves</h2>
        <ol className="steps">
          {deploySteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
