import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatCaatingaError } from "@caatinga/core/browser";
import type { ISupportedWallet } from "@creit.tech/stellar-wallets-kit/types";
import { stellarWalletAdapter } from "../wallet.js";
import {
  cancelWalletSelection,
  getWalletModalState,
  resolveWalletSelection,
  subscribeWalletModal,
} from "../wallet-modal-controller.js";

const LEARN_MORE_URL = "https://developers.stellar.org/docs/build/apps/wallet/overview";

// SWK wallet modules reject with plain `{ code, message }` objects, not Errors.
function describeWalletError(caught: unknown): string {
  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
  }
  return formatCaatingaError(caught);
}

function walletBadge(wallet: ISupportedWallet): string | null {
  if (!wallet.isAvailable) {
    return "Install ↗";
  }
  // Bridge wallets (WalletConnect) hand off to a QR code instead of an extension.
  return wallet.type === "BRIDGE_WALLET" ? "QR code" : null;
}

interface WalletOptionProps {
  wallet: ISupportedWallet;
  connectingId: string | null;
  onSelect(wallet: ISupportedWallet): void;
}

function WalletOption({ wallet, connectingId, onSelect }: WalletOptionProps) {
  const connecting = connectingId === wallet.id;
  const badge = walletBadge(wallet);

  return (
    <li>
      <button
        type="button"
        className={connecting ? "wallet-option wallet-option--connecting" : "wallet-option"}
        onClick={() => onSelect(wallet)}
        disabled={connectingId !== null && !connecting}
      >
        <img className="wallet-option__icon" src={wallet.icon} alt="" />
        <span className="wallet-option__name">
          {connecting ? `Connecting to ${wallet.name}…` : wallet.name}
        </span>
        {connecting ? (
          <span className="wallet-option__spinner" aria-hidden="true" />
        ) : badge ? (
          <span className="wallet-option__badge">{badge}</span>
        ) : (
          <span className="status-dot status-dot--on" aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

export function WalletModal() {
  const { open } = useSyncExternalStore(
    subscribeWalletModal,
    getWalletModalState,
    getWalletModalState
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const [wallets, setWallets] = useState<ISupportedWallet[] | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setWallets(null);
    setConnectingId(null);
    setError(null);

    // Availability probes can take a moment; ignore the result if the modal
    // closed (or reopened) before they resolve.
    let cancelled = false;
    stellarWalletAdapter
      .getSupportedWallets()
      .then((list) => {
        if (!cancelled) {
          setWallets(list);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setWallets([]);
          setError(describeWalletError(caught));
        }
      });

    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cancelWalletSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  async function selectWallet(wallet: ISupportedWallet) {
    if (connectingId) {
      return;
    }

    if (!wallet.isAvailable) {
      window.open(wallet.url, "_blank", "noopener");
      return;
    }

    setError(null);
    setConnectingId(wallet.id);
    try {
      stellarWalletAdapter.setWallet(wallet.id);
      const address = await stellarWalletAdapter.getPublicKey();
      resolveWalletSelection(address);
    } catch (caught) {
      setError(describeWalletError(caught));
    } finally {
      setConnectingId(null);
    }
  }

  const detected = wallets?.filter((wallet) => wallet.isAvailable) ?? [];
  const others = wallets?.filter((wallet) => !wallet.isAvailable) ?? [];

  return (
    <div
      className="wallet-modal"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          cancelWalletSelection();
        }
      }}
    >
      <div
        ref={panelRef}
        className="wallet-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        tabIndex={-1}
      >
        <header className="wallet-modal__header">
          <h2 id="wallet-modal-title">Connect a wallet</h2>
          <button
            type="button"
            className="wallet-modal__close"
            onClick={() => cancelWalletSelection()}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {error ? (
          <p className="wallet-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="wallet-modal__body">
          {wallets === null ? (
            <ul className="wallet-modal__list" aria-label="Loading wallets">
              {[0, 1, 2].map((row) => (
                <li key={row} className="wallet-option wallet-option--skeleton" aria-hidden="true">
                  <span className="wallet-skeleton__icon" />
                  <span className="wallet-skeleton__line" />
                </li>
              ))}
            </ul>
          ) : (
            <>
              {detected.length > 0 ? (
                <>
                  <p className="eyebrow wallet-modal__section">Detected</p>
                  <ul className="wallet-modal__list">
                    {detected.map((wallet) => (
                      <WalletOption
                        key={wallet.id}
                        wallet={wallet}
                        connectingId={connectingId}
                        onSelect={(selected) => void selectWallet(selected)}
                      />
                    ))}
                  </ul>
                </>
              ) : null}

              {others.length > 0 ? (
                <>
                  <p className="eyebrow wallet-modal__section">More wallets</p>
                  <ul className="wallet-modal__list">
                    {others.map((wallet) => (
                      <WalletOption
                        key={wallet.id}
                        wallet={wallet}
                        connectingId={connectingId}
                        onSelect={(selected) => void selectWallet(selected)}
                      />
                    ))}
                  </ul>
                </>
              ) : null}

              {detected.length === 0 && others.length === 0 && !error ? (
                <p className="wallet-modal__empty">
                  No wallets available. Install a Stellar wallet to continue.
                </p>
              ) : null}
            </>
          )}
        </div>

        <footer className="wallet-modal__footer">
          <span>New to Stellar wallets?</span>
          <a href={LEARN_MORE_URL} target="_blank" rel="noreferrer">
            Learn more ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
