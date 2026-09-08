import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { resolveContractId } from "../artifacts/resolve-contract-id.js";
import { createDefaultBindingAdapter } from "../bindings/default-binding-adapter.js";
import { buildXdr as buildTransactionXdr } from "../xdr/build-xdr.js";
import { withWalletTimeout } from "../wallet/with-wallet-timeout.js";
import type {
  CaatingaBindingAdapter,
  CaatingaClientConfig,
  CaatingaContractRegistration,
  CaatingaInvokeOptions,
  CaatingaInvokeResult,
  CaatingaReadOptions,
  CaatingaReadResult,
  CaatingaXdrBuildResult,
} from "../types.js";
import {
  splitArgsAndOptions,
  splitInvokeArgsAndOptions,
  splitReadArgsAndOptions,
} from "./invoke-args.js";
import { prepareReadTransaction, readSimulationResult } from "./transaction-simulate.js";
import { normalizeSubmitResult, submitTransaction } from "./transaction-submit.js";
import type { StellarSdkSignTransaction, SubmitTransactionLike } from "./transaction-types.js";

export class CaatingaContractClient {
  constructor(
    private readonly config: CaatingaClientConfig,
    private readonly contractName: string,
    private readonly registration: CaatingaContractRegistration,
    private readonly bindingAdapter: CaatingaBindingAdapter = createDefaultBindingAdapter(
      registration.binding as never
    )
  ) {}

  async buildXdr(
    method: string,
    argsOrOptions?: Record<string, unknown>,
    maybeOptions?: { debugRaw?: boolean }
  ): Promise<CaatingaXdrBuildResult> {
    const { args, debugRaw } = splitArgsAndOptions(argsOrOptions, maybeOptions);
    const { contractId, transaction } = await this.createTransaction(method, args);

    const xdr = await buildTransactionXdr({
      contractName: this.contractName,
      method,
      contractId,
      transaction,
      rpcUrl: this.config.network.rpcUrl,
      debug: debugRaw,
    });
    delete (xdr as { preparedTransaction?: unknown }).preparedTransaction;

    return xdr;
  }

  async invoke<T = unknown>(
    method: string,
    argsOrOptions?: Record<string, unknown> | CaatingaInvokeOptions,
    maybeOptions?: CaatingaInvokeOptions
  ): Promise<CaatingaInvokeResult<T>> {
    const { args, debugXdr, debugRaw } = splitInvokeArgsAndOptions(argsOrOptions, maybeOptions);
    const { contractId, transaction } = await this.createTransaction(method, args);
    const xdr = await buildTransactionXdr({
      contractName: this.contractName,
      method,
      contractId,
      transaction,
      rpcUrl: this.config.network.rpcUrl,
      debug: debugRaw,
    });

    let signedXdr: string | undefined;
    const signTransaction: StellarSdkSignTransaction = async (xdr) => {
      try {
        signedXdr = await withWalletTimeout("signTransaction", this.config.walletTimeout, () =>
          this.config.wallet.signTransaction({
            xdr,
            networkPassphrase: this.config.network.networkPassphrase,
          })
        );
      } catch (error) {
        if (error instanceof CaatingaError) {
          throw error;
        }

        throw new CaatingaError(
          `Failed to sign XDR for "${this.contractName}.${method}".`,
          CaatingaErrorCode.XDR_SIGN_FAILED,
          "Connect a wallet and approve the transaction.",
          error
        );
      }

      if (typeof signedXdr !== "string" || signedXdr.trim().length === 0) {
        throw new CaatingaError(
          `Failed to sign XDR for "${this.contractName}.${method}".`,
          CaatingaErrorCode.XDR_SIGN_FAILED,
          "Wallet returned an empty or invalid signed XDR. The user may have dismissed the signing prompt.",
          signedXdr
        );
      }

      return { signedTxXdr: signedXdr };
    };

    const raw = await submitTransaction(
      xdr.preparedTransaction,
      signTransaction,
      this.contractName,
      method,
      this.config.network.rpcUrl
    );

    if (
      typeof (xdr.preparedTransaction as SubmitTransactionLike).signAndSend === "function" &&
      signedXdr === undefined
    ) {
      throw new CaatingaError(
        `Failed to sign XDR for "${this.contractName}.${method}".`,
        CaatingaErrorCode.XDR_SIGN_FAILED,
        "Wallet returned an empty or invalid signed XDR. The generated transaction did not request a wallet signature."
      );
    }

    const normalized = normalizeSubmitResult<T>(raw);

    return {
      status: normalized.status,
      contract: this.contractName,
      method,
      contractId,
      ...(normalized.transactionHash ? { transactionHash: normalized.transactionHash } : {}),
      ...(normalized.result !== undefined ? { result: normalized.result } : {}),
      ...(normalized.resultXdr !== undefined ? { resultXdr: normalized.resultXdr } : {}),
      ...(normalized.diagnosticEvents !== undefined
        ? { diagnosticEvents: normalized.diagnosticEvents }
        : {}),
      ...(debugXdr
        ? {
            xdr: {
              unsigned: xdr.unsignedXdr,
              prepared: xdr.preparedXdr,
              ...(signedXdr ? { signed: signedXdr } : {}),
            },
          }
        : {}),
      ...(debugRaw ? { raw } : {}),
    };
  }

  async simulate<T = unknown>(
    method: string,
    argsOrOptions?: Record<string, unknown> | CaatingaReadOptions,
    maybeOptions?: CaatingaReadOptions
  ): Promise<CaatingaReadResult<T>> {
    const { args, debugRaw } = splitReadArgsAndOptions(argsOrOptions, maybeOptions);
    const { contractId, transaction } = await this.createTransaction(method, args);
    const raw = await prepareReadTransaction(
      transaction,
      this.contractName,
      method,
      this.config.network.rpcUrl
    );
    const result = readSimulationResult<T>(raw, this.contractName, method);

    return {
      status: "simulated",
      contract: this.contractName,
      method,
      contractId,
      result,
      ...(debugRaw ? { raw } : {}),
    };
  }

  async read<T = unknown>(
    method: string,
    argsOrOptions?: Record<string, unknown> | CaatingaReadOptions,
    maybeOptions?: CaatingaReadOptions
  ): Promise<T> {
    const result = await this.simulate<T>(method, argsOrOptions, maybeOptions);
    return result.result;
  }

  private async createTransaction(method: string, args?: Record<string, unknown>) {
    const contractId = resolveContractId({
      artifacts: this.config.artifacts,
      network: this.config.network.name,
      contract: this.contractName,
      explicitContractId: this.registration.contractId,
    });

    let publicKey: string;
    try {
      publicKey = await withWalletTimeout("getPublicKey", this.config.walletTimeout, () =>
        this.config.wallet.getPublicKey()
      );
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Wallet is not connected or the public key is unavailable for "${this.contractName}".`,
        CaatingaErrorCode.WALLET_NOT_CONNECTED,
        "Connect the wallet and grant account access, then retry.",
        error
      );
    }
    const client = this.bindingAdapter.createClient({
      contractId,
      publicKey,
      rpcUrl: this.config.network.rpcUrl,
      networkPassphrase: this.config.network.networkPassphrase,
    });
    const transaction = await this.bindingAdapter.callMethod({ client, method, args });

    return { contractId, transaction };
  }
}
