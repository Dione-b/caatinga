import { describe, expect, it, vi } from "vitest";
import { withRetries } from "./with-retries.js";

describe("withRetries", () => {
  it("returns the first successful result without retrying", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    const onRetry = vi.fn();

    const result = await withRetries({
      delaysMs: [0, 0],
      run,
      isRetryable: () => true,
      onRetry,
    });

    expect(result).toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("retries a retryable failure and reports each retry (1-based, delaysMs.length + 1 attempts)", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient-1"))
      .mockRejectedValueOnce(new Error("transient-2"))
      .mockResolvedValue("recovered");
    const onRetry = vi.fn();

    const result = await withRetries({
      delaysMs: [0, 0],
      run,
      isRetryable: () => true,
      onRetry,
    });

    expect(result).toBe("recovered");
    expect(run).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, { attempt: 1, maxAttempts: 3, delayMs: 0 });
    expect(onRetry).toHaveBeenNthCalledWith(2, { attempt: 2, maxAttempts: 3, delayMs: 0 });
  });

  it("rethrows a non-retryable error immediately without retrying", async () => {
    const fatal = new Error("fatal");
    const run = vi.fn().mockRejectedValue(fatal);
    const onRetry = vi.fn();

    await expect(
      withRetries({ delaysMs: [0, 0], run, isRetryable: () => false, onRetry })
    ).rejects.toBe(fatal);

    expect(run).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("rethrows the original error after the last attempt fails", async () => {
    const last = new Error("still failing");
    const run = vi.fn().mockRejectedValue(last);

    await expect(
      withRetries({ delaysMs: [0], run, isRetryable: () => true })
    ).rejects.toBe(last);

    // one initial + one retry = 2 attempts for a single-delay config
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not let a throwing onRetry mask the operation result", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("transient")).mockResolvedValue("ok");
    const onRetry = vi.fn(() => {
      throw new Error("callback blew up");
    });

    const result = await withRetries({
      delaysMs: [0],
      run,
      isRetryable: () => true,
      onRetry,
    });

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
