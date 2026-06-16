import { WalletProvider, useWallet } from "@caatinga/client/react";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";
import { ContractNotDeployed } from "./components/ContractNotDeployed";
import { WalletButton } from "./components/WalletButton";
import { WalletModal } from "./components/WalletModal";
import { ZkStatusPanel } from "./components/ZkStatusPanel";
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
      ) : (
        <ZkStatusPanel artifacts={artifacts} publicKey={publicKey} />
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
