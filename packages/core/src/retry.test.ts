import { describe, expect, it, vi } from "vitest";
import { withRetries } from "./retry.js";

describe("withRetries", () => {
  it("retries transient failures and reports one-based retry metadata", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue("ok");
    const onRetry = vi.fn();

    await expect(
      withRetries({ delays: [0], fn, isRetryable: () => true, onRetry })
    ).resolves.toBe("ok");

    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      maxAttempts: 2,
      delayMs: 0,
      error: expect.any(Error),
    });
  });

  it("does not retry non-retryable failures", async () => {
    const error = new Error("permanent");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetries({ delays: [0, 0], fn, isRetryable: () => false })
    ).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("preserves the last operation error when retries are exhausted", async () => {
    const error = new Error("still unavailable");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetries({ delays: [0, 0], fn, isRetryable: () => true })
    ).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("ignores retry callback failures", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue("ok");

    await expect(
      withRetries({
        delays: [0],
        fn,
        isRetryable: () => true,
        onRetry: () => { throw new Error("observer failed"); },
      })
    ).resolves.toBe("ok");
  });
});
