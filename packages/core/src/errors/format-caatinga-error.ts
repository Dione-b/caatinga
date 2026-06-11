import { CaatingaError } from "./CaatingaError.js";

/**
 * Render an error for display. For a {@link CaatingaError} this surfaces the
 * code, message, and hint, plus the underlying `cause` (when present) so the
 * real reason — e.g. a wallet rejection or an XDR parse error — is never hidden
 * behind a generic hint. Falls back to the plain message for other errors.
 */
export function formatCaatingaError(error: unknown): string {
  if (error instanceof CaatingaError) {
    const lines = [`[${error.code}] ${error.message}`];

    if (error.hint) {
      lines.push("", error.hint);
    }

    const detail = formatCause(error.cause);
    if (detail) {
      lines.push("", `Details: ${detail}`);
    }

    return lines.join("\n");
  }

  return error instanceof Error ? error.message : String(error);
}

function formatCause(cause: unknown): string {
  if (cause === undefined || cause === null) {
    return "";
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
