import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { resolveContractId } from "../artifacts/resolve-contract-id.js";
import { createDefaultBindingAdapter } from "../bindings/default-binding-adapter.js";
import { DEFAULT_READ_SOURCE_ACCOUNT } from "../constants.js";
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
import {
  prepareReadTransaction,
  readSimulationResult,
  toSimulationError,
} from "./transaction-simulate.js";
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
    const { args, debugXdr, debugRaw, restore } = splitInvokeArgsAndOptions(
      argsOrOptions,
      maybeOptions
    );
    const { contractId, transaction } = await this.createTransaction(
      method,
      args,
      restore ? this.createRestoreMethodOptions(method) : undefined
    );
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
      if (!this.config.wallet) {
        throw new CaatingaError(
          `Failed to sign XDR for "${this.contractName}.${method}".`,
          CaatingaErrorCode.WALLET_NOT_CONNECTED,
          "Connect a wallet and approve the transaction."
        );
      }

      try {
        signedXdr = await withWalletTimeout("signTransaction", this.config.walletTimeout, () =>
          this.config.wallet!.signTransaction({
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
    const { args, debugRaw, sourceAccount } = splitReadArgsAndOptions(argsOrOptions, maybeOptions);
    const { contractId, transaction } = await this.createTransaction(method, args, {
      readOnly: true,
      sourceAccount,
    });
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

  private async createTransaction(
    method: string,
    args?: Record<string, unknown>,
    methodOptions?: Record<string, unknown>
  ) {
    const contractId = resolveContractId({
      artifacts: this.config.artifacts,
      network: this.config.network.name,
      contract: this.contractName,
      explicitContractId: this.registration.contractId,
    });

    const resolvedSource = options.readOnly
      ? await this.resolveReadPublicKey(method, options.sourceAccount)
      : await this.resolveWalletPublicKey();

    const client = this.bindingAdapter.createClient({
      contractId,
      // The placeholder default is never sent to the RPC: omitting `publicKey` makes the
      // binding client use the SDK's local `new Account(NULL_ACCOUNT, "0")` instead of a
      // `Server.getAccount(<null account>)` lookup, which fails on unfunded networks.
      publicKey: resolvedSource === DEFAULT_READ_SOURCE_ACCOUNT ? undefined : resolvedSource,
      rpcUrl: this.config.network.rpcUrl,
      networkPassphrase: this.config.network.networkPassphrase,
    });
    const transaction = await this.bindingAdapter.callMethod({ client, method, args });

    return { contractId, transaction };
  }

  private async resolveWalletPublicKey(): Promise<string> {
    if (!this.config.wallet) {
      throw new CaatingaError(
        `Wallet is not connected or the public key is unavailable for "${this.contractName}".`,
        CaatingaErrorCode.WALLET_NOT_CONNECTED,
        "Connect the wallet and grant account access, then retry."
      );
    }

    let publicKey: string;
    try {
      publicKey = await withWalletTimeout("getPublicKey", this.config.walletTimeout, () =>
        this.config.wallet!.getPublicKey()
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
    let transaction: unknown;
    try {
      transaction = await this.bindingAdapter.callMethod({
        client,
        method,
        args,
        methodOptions,
      });
    } catch (error) {
      throw toSimulationError(error, this.contractName, method, this.config.network.rpcUrl);
    }

    if (typeof publicKey !== "string" || publicKey.trim().length === 0) {
      throw new CaatingaError(
        `Wallet is not connected or the public key is unavailable for "${this.contractName}".`,
        CaatingaErrorCode.WALLET_NOT_CONNECTED,
        "Connect the wallet and grant account access, then retry."
      );
    }

    return publicKey;
  }

  /**
   * Source account for `simulate()` / `read()`, in precedence order:
   * 1. `options.sourceAccount` from this call,
   * 2. the connected wallet's public key,
   * 3. `CaatingaClientConfig.readSourceAccount`,
   * 4. `DEFAULT_READ_SOURCE_ACCOUNT`.
   *
   * The wallet wins over configured config because config is a fallback for visitors
   * without a wallet; pass `options.sourceAccount` to deliberately read as another account.
   */
  private async resolveReadPublicKey(method: string, perCallSource?: string): Promise<string> {
    const context = `${this.contractName}.${method}`;

    const explicit = normalizeReadSourceAccount(perCallSource);
    if (explicit !== undefined) {
      return assertReadSourceAccount(explicit, `the sourceAccount option of "${context}"`);
    }

    const walletPublicKey = await this.tryWalletPublicKey();
    if (walletPublicKey !== undefined) {
      return walletPublicKey;
    }

    const configured = normalizeReadSourceAccount(this.config.readSourceAccount);
    if (configured !== undefined) {
      return assertReadSourceAccount(
        configured,
        `CaatingaClientConfig.readSourceAccount of "${context}"`
      );
    }

    return DEFAULT_READ_SOURCE_ACCOUNT;
  }

  /**
   * Wallet public key for read-only calls, or `undefined` when the wallet cannot provide
   * one (not configured, disconnected, locked, or an empty address). Reads must keep
   * working for visitors without a wallet, so adapter rejections fall back to the
   * configured/default source, including `CAATINGA_WALLET_NOT_CONNECTED`, which adapters
   * raise for "no account access".
   *
   * `CAATINGA_WALLET_TIMEOUT` and other Caatinga errors are rethrown instead of masked:
   * they mean the adapter broke its "reject on dismissal" contract or hit a real failure,
   * and quietly reading as the placeholder account would hide it.
   */
  private async tryWalletPublicKey(): Promise<string | undefined> {
    const wallet = this.config.wallet;
    if (!wallet) {
      return undefined;
    }

    let publicKey: string;
    try {
      publicKey = await withWalletTimeout("getPublicKey", this.config.walletTimeout, () =>
        wallet.getPublicKey()
      );
    } catch (error) {
      if (error instanceof CaatingaError && error.code !== CaatingaErrorCode.WALLET_NOT_CONNECTED) {
        throw error;
      }

      return undefined;
    }

    return typeof publicKey === "string" && publicKey.trim().length > 0 ? publicKey : undefined;
  }

  private createRestoreMethodOptions(method: string): Record<string, unknown> {
    return {
      restore: true,
      signTransaction: async (xdr: string) => {
        let signedTxXdr: string;
        try {
          signedTxXdr = await withWalletTimeout("signTransaction", this.config.walletTimeout, () =>
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
            `Failed to sign the state restoration transaction for "${this.contractName}.${method}".`,
            CaatingaErrorCode.XDR_SIGN_FAILED,
            "Approve the RestoreFootprint transaction in the wallet and retry.",
            error
          );
        }

        if (typeof signedTxXdr !== "string" || signedTxXdr.trim().length === 0) {
          throw new CaatingaError(
            `Failed to sign the state restoration transaction for "${this.contractName}.${method}".`,
            CaatingaErrorCode.XDR_SIGN_FAILED,
            "Wallet returned an empty or invalid signed XDR for RestoreFootprint.",
            signedTxXdr
          );
        }

        return { signedTxXdr };
      },
    };
  }
}
