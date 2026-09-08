import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isLikelyPublicKeySource } from "../stellar-cli/recover-deploy-contract-id.js";

const STELLAR_SECRET_KEY_PATTERN = /^S[A-Z2-7]{55}$/;

export function validateSourceShape(source: string): CaatingaError | undefined {
  if (source.startsWith("-")) {
    return new CaatingaError(
      "Refusing to accept a flag-shaped value as --source.",
      CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT,
      "Use a Stellar CLI identity alias instead, for example: --source alice"
    );
  }

  if (STELLAR_SECRET_KEY_PATTERN.test(source)) {
    return new CaatingaError(
      "Refusing to accept a Stellar secret key as --source.",
      CaatingaErrorCode.SOURCE_IS_SECRET_KEY,
      "Use a Stellar CLI identity alias instead, for example: --source alice"
    );
  }

  if (source.trim().includes(" ")) {
    return new CaatingaError(
      "Refusing to accept a seed phrase as --source.",
      CaatingaErrorCode.SOURCE_IS_SEED_PHRASE,
      "Use a Stellar CLI identity alias instead, for example: --source alice"
    );
  }

  if (isLikelyPublicKeySource(source)) {
    return new CaatingaError(
      `Public account address cannot sign transactions: ${source}`,
      CaatingaErrorCode.SOURCE_IS_PUBLIC_KEY,
      "Use a Stellar CLI identity with a secret key. Example: stellar keys generate alice --fund --network testnet, then --source alice"
    );
  }

  if (source.startsWith("G")) {
    return new CaatingaError(
      "Refusing to accept a public account address as --source.",
      CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT,
      "Use a Stellar CLI identity alias, not a public address. Example: --source alice"
    );
  }

  return undefined;
}
