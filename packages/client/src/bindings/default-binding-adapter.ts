import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import type { CaatingaBindingAdapter } from "../types.js";

interface BindingWithClient {
  Client?: new (input: {
    contractId: string;
    publicKey: string;
    rpcUrl: string;
    networkPassphrase: string;
  }) => unknown;
}

export function createDefaultBindingAdapter(binding: BindingWithClient): CaatingaBindingAdapter {
  return {
    createClient({ contractId, publicKey, rpcUrl, networkPassphrase }) {
      if (!binding.Client) {
        throw new CaatingaError(
          "Generated binding does not export Client.",
          CaatingaErrorCode.BINDING_CLIENT_NOT_FOUND,
          "Regenerate bindings with Stellar CLI."
        );
      }

      return new binding.Client({
        contractId,
        publicKey,
        rpcUrl,
        networkPassphrase
      });
    },

    async callMethod({ client, method, args }) {
      const candidate = client as Record<string, unknown>;
      const fn = candidate[method];

      if (typeof fn !== "function") {
        throw new CaatingaError(
          `Binding method "${method}" was not found.`,
          CaatingaErrorCode.BINDING_METHOD_NOT_FOUND,
          "Check the contract method name or regenerate bindings."
        );
      }

      return args ? fn.call(client, args) : fn.call(client);
    }
  };
}
