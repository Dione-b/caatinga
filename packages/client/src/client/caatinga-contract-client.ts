import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { resolveContractId } from "../artifacts/resolve-contract-id.js";
import { createDefaultBindingAdapter } from "../bindings/default-binding-adapter.js";
import { buildXdr as buildTransactionXdr } from "../xdr/build-xdr.js";
import type {
  CaatingaBindingAdapter,
  CaatingaClientConfig,
  CaatingaContractRegistration,
  CaatingaInvokeOptions,
  CaatingaInvokeResult,
  CaatingaReadOptions,
  CaatingaReadResult,
  CaatingaXdrBuildResult
} from "../types.js";

type StellarSdkSignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }> | { signedTxXdr: string };

interface SubmitTransactionLike {
  signAndSend?: (
    input?: { signTransaction?: StellarSdkSignTransaction }
  ) => Promise<unknown> | unknown;
  send?: () => Promise<unknown> | unknown;
}

interface SimulateTransactionLike {
  prepare?: () => Promise<unknown> | unknown;
}

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

    return buildTransactionXdr({
      contractName: this.contractName,
      method,
      contractId,
      transaction,
      rpcUrl: this.config.network.rpcUrl,
      debug: debugRaw
    });
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
      debug: debugRaw
    });

    let signedXdr: string | undefined;
    const signTransaction: StellarSdkSignTransaction = async (xdr) => {
      try {
        signedXdr = await this.withWalletTimeout("signTransaction", () =>
          this.config.wallet.signTransaction({
            xdr,
            networkPassphrase: this.config.network.networkPassphrase
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
      transaction,
      signTransaction,
      this.contractName,
      method,
      this.config.network.rpcUrl
    );

    if (
      typeof (transaction as SubmitTransactionLike).signAndSend === "function" &&
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
      status: "confirmed",
      contract: this.contractName,
      method,
      contractId,
      ...(normalized.transactionHash ? { transactionHash: normalized.transactionHash } : {}),
      ...(normalized.result !== undefined ? { result: normalized.result } : {}),
      ...(debugXdr
        ? {
            xdr: {
              unsigned: xdr.unsignedXdr,
              prepared: xdr.preparedXdr,
              ...(signedXdr ? { signed: signedXdr } : {})
            }
          }
        : {}),
      ...(debugRaw ? { raw } : {})
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
      ...(debugRaw ? { raw } : {})
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
      explicitContractId: this.registration.contractId
    });

    let publicKey: string;
    try {
      publicKey = await this.withWalletTimeout("getPublicKey", () =>
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
      networkPassphrase: this.config.network.networkPassphrase
    });
    const transaction = await this.bindingAdapter.callMethod({ client, method, args });

    return { contractId, transaction };
  }

  private withWalletTimeout<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const timeoutMs = this.config.walletTimeout;
    if (timeoutMs === undefined || timeoutMs <= 0) {
      return fn();
    }

    let timedOut = false;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        reject(
          new CaatingaError(
            `Wallet "${label}" timed out after ${timeoutMs}ms.`,
            CaatingaErrorCode.WALLET_TIMEOUT,
            "Ensure the wallet adapter rejects on user dismissal, or increase walletTimeout."
          )
        );
      }, timeoutMs);

      fn().then(
        (value) => {
          if (timedOut) {
            return;
          }
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (timedOut) {
            return;
          }
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}

function splitArgsAndOptions(
  argsOrOptions?: Record<string, unknown>,
  maybeOptions?: { debugRaw?: boolean }
) {
  return {
    args: argsOrOptions,
    debugRaw: maybeOptions?.debugRaw ?? false
  };
}

function splitInvokeArgsAndOptions(
  argsOrOptions?: Record<string, unknown> | CaatingaInvokeOptions,
  maybeOptions?: CaatingaInvokeOptions
) {
  const looksLikeOptions =
    argsOrOptions !== undefined &&
    ("debugXdr" in argsOrOptions || "debugRaw" in argsOrOptions) &&
    maybeOptions === undefined;

  if (looksLikeOptions) {
    const options = argsOrOptions as CaatingaInvokeOptions;
    return {
      args: undefined,
      debugXdr: options.debugXdr ?? false,
      debugRaw: options.debugRaw ?? false
    };
  }

  return {
    args: argsOrOptions as Record<string, unknown> | undefined,
    debugXdr: maybeOptions?.debugXdr ?? false,
    debugRaw: maybeOptions?.debugRaw ?? false
  };
}

function splitReadArgsAndOptions(
  argsOrOptions?: Record<string, unknown> | CaatingaReadOptions,
  maybeOptions?: CaatingaReadOptions
) {
  const looksLikeOptions =
    argsOrOptions !== undefined &&
    "debugRaw" in argsOrOptions &&
    maybeOptions === undefined;

  if (looksLikeOptions) {
    const options = argsOrOptions as CaatingaReadOptions;
    return {
      args: undefined,
      debugRaw: options.debugRaw ?? false
    };
  }

  return {
    args: argsOrOptions as Record<string, unknown> | undefined,
    debugRaw: maybeOptions?.debugRaw ?? false
  };
}

async function submitTransaction(
  transaction: unknown,
  signTransaction: StellarSdkSignTransaction,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SubmitTransactionLike;

  if (typeof candidate.signAndSend === "function") {
    try {
      const raw = await candidate.signAndSend.call(transaction, { signTransaction });
      assertSubmitResultRecognized(raw, contractName, method);
      return raw;
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to submit XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_SUBMIT_FAILED,
        `RPC: ${rpcUrl}. Check wallet signature and RPC connectivity.`,
        error
      );
    }
  }

  if (typeof candidate.send === "function") {
    try {
      const raw = await candidate.send.call(transaction);
      assertSubmitResultRecognized(raw, contractName, method);
      return raw;
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to submit XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_SUBMIT_FAILED,
        `RPC: ${rpcUrl}. Check wallet signature and RPC connectivity.`,
        error
      );
    }
  }

  throw new CaatingaError(
    `Binding transaction for "${contractName}.${method}" cannot be submitted.`,
    CaatingaErrorCode.XDR_SUBMIT_FAILED,
    "Regenerate bindings or provide a compatible binding adapter."
  );
}

async function prepareReadTransaction(
  transaction: unknown,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SimulateTransactionLike;

  if (typeof candidate.prepare !== "function") {
    return transaction;
  }

  try {
    return await candidate.prepare.call(transaction);
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw error;
    }

    throw new CaatingaError(
      `Failed to prepare XDR for "${contractName}.${method}".`,
      CaatingaErrorCode.XDR_PREPARE_FAILED,
      `RPC: ${rpcUrl}. Check connectivity, simulation errors, and binding compatibility.`,
      error
    );
  }
}

function readSimulationResult<T>(raw: unknown, contractName: string, method: string): T {
  if (raw !== null && typeof raw === "object" && "result" in raw) {
    const result = (raw as { result?: T }).result;
    if (result !== undefined) {
      return result;
    }
  }

  throw new CaatingaError(
    `Simulation for "${contractName}.${method}" did not return a result.`,
    CaatingaErrorCode.READ_RESULT_MISSING,
    `Expected "${contractName}.${method}" to expose a simulation result. Use debugRaw to inspect the generated binding output.`
  );
}

function assertSubmitResultRecognized(raw: unknown, contractName: string, method: string): void {
  if (raw === null || typeof raw !== "object") {
    return;
  }

  const record = raw as Record<string, unknown>;
  const hasTransactionId =
    "txHash" in record ||
    "transactionHash" in record ||
    "hash" in record ||
    hasNestedSendTransactionResponseHash(record);
  const hasResult = "result" in record;

  if (hasTransactionId || hasResult) {
    return;
  }

  throw new CaatingaError(
    `Submit returned an unrecognized payload for "${contractName}.${method}".`,
    CaatingaErrorCode.XDR_RESULT_FAILED,
    "Expected txHash, transactionHash, hash, sendTransactionResponse.hash, or result on the submit response. Use debugRaw to inspect the binding output."
  );
}

function hasNestedSendTransactionResponseHash(record: Record<string, unknown>): boolean {
  const response = record.sendTransactionResponse;
  return response !== null && typeof response === "object" && "hash" in response;
}

function normalizeSubmitResult<T>(raw: unknown): {
  transactionHash?: string;
  result?: T;
} {
  const candidate = raw as {
    txHash?: string;
    transactionHash?: string;
    hash?: string;
    sendTransactionResponse?: {
      hash?: string;
    };
    result?: T;
  };

  return {
    transactionHash:
      candidate.txHash ??
      candidate.transactionHash ??
      candidate.hash ??
      candidate.sendTransactionResponse?.hash,
    result: candidate.result
  };
}
