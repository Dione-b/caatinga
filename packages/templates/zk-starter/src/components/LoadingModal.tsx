interface LoadingModalProps {
  label?: string;
}

export function LoadingModal({ label = "Loading…" }: LoadingModalProps) {
  return (
    <div className="loading-modal" role="status" aria-live="polite" aria-label={label}>
      <div className="loading-modal__card">
        <span className="loading-modal__spinner" aria-hidden="true" />
        <span className="loading-modal__label">{label}</span>
      </div>
    </div>
  );
}
