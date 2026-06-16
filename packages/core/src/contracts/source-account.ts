import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { validateSourceShape } from "./validate-source-shape.js";

export function assertSafeSourceAccount(source: string | undefined): string {
  if (!source) {
    throw new CaatingaError(
      "A source account or Stellar CLI identity is required.",
      CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED,
      "Pass a Stellar CLI identity alias, for example: --source alice"
    );
  }

  const unsafeSource = validateSourceShape(source);
  if (unsafeSource) {
    throw unsafeSource;
  }

  return source;
}

export function resolveCliSource(explicit?: string): string {
  return assertSafeSourceAccount(explicit ?? process.env.CAATINGA_SOURCE ?? "alice");
}
