const MAX_CAUSE_DEPTH = 5;

/**
 * Collects every place a failed command's output can hide.
 *
 * `runCommand` throws a `CaatingaError` whose `message` is just
 * `Command failed: <cmd> <args>` and puts the combined stdout/stderr in `hint`,
 * keeping the original error as `cause`; callers that re-wrap it push that
 * output one level further down. Matching only `message` finds nothing, so the
 * text is gathered from the message, hint and cause of each error in the chain.
 */
export function collectErrorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < MAX_CAUSE_DEPTH; depth++) {
    const { hint, cause } = current as { hint?: unknown; cause?: unknown };
    parts.push(current.message);
    if (typeof hint === "string") {
      parts.push(hint);
    }
    if (typeof cause === "string") {
      parts.push(cause);
    }
    current = cause;
  }
  return parts.join("\n");
}
