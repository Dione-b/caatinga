import { WalletProvider, useWallet } from "@caatinga/client/react";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";
import { CircuitCard } from "./components/CircuitCard";
import { ContractNotDeployed } from "./components/ContractNotDeployed";
import { WalletButton } from "./components/WalletButton";
import { WalletModal } from "./components/WalletModal";
import { stellarWalletAdapter } from "./wallet.js";

const artifacts = artifactsJson as CaatingaArtifacts;
const verifierContractId = artifacts.networks?.testnet?.contracts?.verifier?.contractId;
const isDeployed = Boolean(verifierContractId);

function AppBody() {
  const { publicKey } = useWallet();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Caatinga ZK</p>
          <h1>__PROJECT_NAME__</h1>
        </div>
        <WalletButton />
      </header>

      {!isDeployed ? (
        <ContractNotDeployed />
      ) : publicKey ? (
        <CircuitCard />
      ) : (
        <section className="counter-panel" aria-labelledby="connect-title">
          <div className="counter-panel__header">
            <div>
              <p className="eyebrow">Get started</p>
              <h2 id="connect-title">Connect your wallet</h2>
            </div>
            <span className="network-pill">testnet</span>
          </div>
          <p>Connect a Stellar wallet to verify Groth16 proofs on the deployed verifier contract.</p>
        </section>
      )}
    </main>
  );
}

export default function App() {
  return (
    <WalletProvider adapter={stellarWalletAdapter} options={{ persist: true }}>
      <AppBody />
      <WalletModal />
    </WalletProvider>
  );
}
