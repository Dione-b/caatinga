import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";

export function withWalletTimeout<T>(
  label: string,
  timeoutMs: number | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return fn();
  }

  let timedOut = false;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        new CaatingaError(
          `Wallet "${label}" timed out after ${timeoutMs}ms.`,
          CaatingaErrorCode.WALLET_TIMEOUT,
          "Ensure the wallet adapter rejects on user dismissal, or increase walletTimeout."
        )
      );
    }, timeoutMs);

    fn().then(
      (value) => {
        if (timedOut) {
          return;
        }
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (timedOut) {
          return;
        }
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
