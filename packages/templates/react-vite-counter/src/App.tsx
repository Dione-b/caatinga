import { CounterCard } from "./components/CounterCard";
import { WalletButton } from "./components/WalletButton";
import { WalletProvider, useWallet } from "./context/WalletContext";

function AppBody() {
  const { publicKey } = useWallet();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Caatinga</p>
          <h1>__PROJECT_NAME__</h1>
        </div>
        <WalletButton />
      </header>

      {publicKey ? (
        <CounterCard />
      ) : (
        <section className="counter-panel" aria-labelledby="connect-title">
          <div className="counter-panel__header">
            <div>
              <p className="eyebrow">Get started</p>
              <h2 id="connect-title">Connect your wallet</h2>
            </div>
            <span className="network-pill">testnet</span>
          </div>
          <p>Connect a Stellar wallet to read and update the counter contract.</p>
        </section>
      )}
    </main>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppBody />
    </WalletProvider>
  );
}
