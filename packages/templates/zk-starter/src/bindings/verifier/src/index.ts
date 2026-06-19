// Placeholder bindings. This file exists so the template type-checks before you
// run `caatinga generate`. It does NOT talk to the chain — every method throws a
// clear, actionable error. `caatinga generate verifier` overwrites this file with
// real @stellar/stellar-sdk generate bindings.
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";

export const __caatingaPlaceholder = true;

const GENERATE_HINT =
  "Run `npx caatinga generate verifier --network testnet`, then restart the dev server.";

function placeholderBinding(method: string): never {
  throw new CaatingaError(
    `Placeholder bindings are still in use for "verifier.${method}".`,
    CaatingaErrorCode.PLACEHOLDER_BINDING,
    GENERATE_HINT
  );
}

export class Client {
  constructor(
    private readonly input: {
      contractId: string;
      publicKey: string;
      rpcUrl: string;
      networkPassphrase: string;
    }
  ) {}

  verify_proof(_args: {
    vk: {
      alpha: unknown;
      beta: unknown;
      gamma: unknown;
      delta: unknown;
      ic: unknown[];
    };
    proof: {
      a: unknown;
      b: unknown;
      c: unknown;
    };
    pub_signals: bigint[];
  }): never {
    return placeholderBinding("verify_proof");
  }

  describe(): string {
    return `${this.input.contractId}:${this.input.publicKey}`;
  }
}
