export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
}

export interface WithRetriesOptions<T> {
  /** One delay per retry. The operation runs once plus this many retries. */
  delays: readonly number[];
  fn: () => Promise<T>;
  isRetryable: (error: unknown) => boolean;
  onRetry?: (info: RetryInfo) => void;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run an operation with consistent delay, callback, and final-attempt semantics. */
export async function withRetries<T>(options: WithRetriesOptions<T>): Promise<T> {
  const maxAttempts = options.delays.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await options.fn();
    } catch (error) {
      if (attempt + 1 >= maxAttempts || !options.isRetryable(error)) {
        throw error;
      }

      const delayMs = options.delays[attempt] ?? options.delays[options.delays.length - 1] ?? 0;
      try {
        options.onRetry?.({ attempt: attempt + 1, maxAttempts, delayMs, error });
      } catch {
        // Retry callbacks are observational and must not mask the operation error.
      }
      await sleep(delayMs);
    }
  }

  throw new Error("Retry loop exited without a result.");
}
