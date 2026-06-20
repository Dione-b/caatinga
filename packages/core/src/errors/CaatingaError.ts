import { CaatingaErrorCode, type CaatingaErrorCodeValue } from "./CaatingaErrorCode.js";

export { CaatingaErrorCode } from "./CaatingaErrorCode.js";

export class CaatingaError extends Error {
  constructor(
    message: string,
    public readonly code: CaatingaErrorCodeValue,
    public readonly hint?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "CaatingaError";
  }
}

const ZK_ERROR_CODE_MAP: Record<string, CaatingaErrorCodeValue> = {
  ZK_VERIFY_FAILED: CaatingaErrorCode.ZK_VERIFICATION_FAILED,
};

export function toCaatingaError(error: unknown): CaatingaError {
  if (error instanceof CaatingaError) {
    return error;
  }

  if (error instanceof Error) {
    const zkCode =
      "code" in error && typeof error.code === "string" ? ZK_ERROR_CODE_MAP[error.code] : undefined;

    if (zkCode) {
      return new CaatingaError(
        error.message,
        zkCode,
        "hint" in error && typeof error.hint === "string" ? error.hint : undefined,
        error
      );
    }

    return new CaatingaError(error.message, CaatingaErrorCode.UNEXPECTED_ERROR, undefined, error);
  }

  return new CaatingaError("An unexpected error occurred.", CaatingaErrorCode.UNEXPECTED_ERROR);
}
