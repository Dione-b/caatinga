export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type RetryInfo = {
  /** 1-based attempt number that just failed and is about to be retried. */
  attempt: number;
  /** Total attempts that will be made (initial try + one per configured delay). */
  maxAttempts: number;
  /** Delay before the upcoming retry. */
  delayMs: number;
};

export type WithRetriesOptions<T> = {
  /** Backoff delays; one entry per retry. `attempts` = delays.length + 1. */
  delaysMs: readonly number[];
  /** The operation to run. Its resolved value is returned as-is. */
  run: () => Promise<T>;
  /** Whether a thrown error is worth retrying. Non-retryable errors rethrow immediately. */
  isRetryable: (error: unknown) => boolean;
  /** Notified before each backoff sleep. Errors thrown here are swallowed. */
  onRetry?: (info: RetryInfo) => void;
};

/**
 * Runs `run`, retrying on retryable failures with the given backoff delays.
 *
 * A non-retryable error, or the failure of the final attempt, rethrows the
 * original error untouched. The `onRetry` callback is guarded: a throwing
 * callback never masks the operation's own error (matching the guarded
 * behavior post-deploy already had, and fixing the unguarded deploy/upgrade
 * loops it was copied from).
 */
export async function withRetries<T>(options: WithRetriesOptions<T>): Promise<T> {
  const { delaysMs, run, isRetryable, onRetry } = options;
  const maxAttempts = delaysMs.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }

      const delayMs = delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 0;
      try {
        onRetry?.({ attempt: attempt + 1, maxAttempts, delayMs });
      } catch {
        // Callback error is non-fatal; the original transient error takes precedence.
      }
      await sleep(delayMs);
    }
  }

  // Unreachable: the final attempt either returns or throws above.
  throw new Error("withRetries exhausted without returning or throwing");
}
