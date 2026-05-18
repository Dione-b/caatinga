import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import { resolveContractId } from "../artifacts/resolve-contract-id.js";
import { createDefaultBindingAdapter } from "../bindings/default-binding-adapter.js";
import { buildXdr as buildTransactionXdr } from "../xdr/build-xdr.js";
import type {
  CaatingaBindingAdapter,
  CaatingaClientConfig,
  CaatingaContractRegistration,
  CaatingaInvokeOptions,
  CaatingaInvokeResult,
  CaatingaXdrBuildResult
} from "../types.js";

interface SubmitTransactionLike {
  signAndSend?: (input?: { signedXdr: string }) => Promise<unknown> | unknown;
  send?: (input?: { signedXdr: string }) => Promise<unknown> | unknown;
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

    let signedXdr: string;
    try {
      signedXdr = await this.withWalletTimeout("signTransaction", () =>
        this.config.wallet.signTransaction({
          xdr: xdr.preparedXdr,
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

    const raw = await submitTransaction(
      transaction,
      signedXdr,
      this.contractName,
      method,
      this.config.network.rpcUrl
    );
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
              signed: signedXdr
            }
          }
        : {}),
      ...(debugRaw ? { raw } : {})
    };
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

async function submitTransaction(
  transaction: unknown,
  signedXdr: string,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SubmitTransactionLike;
  const submit = candidate.signAndSend ?? candidate.send;

  if (typeof submit !== "function") {
    throw new CaatingaError(
      `Binding transaction for "${contractName}.${method}" cannot be submitted.`,
      CaatingaErrorCode.XDR_SUBMIT_FAILED,
      "Regenerate bindings or provide a compatible binding adapter."
    );
  }

  try {
    const raw = await submit.call(transaction, { signedXdr });
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

function assertSubmitResultRecognized(raw: unknown, contractName: string, method: string): void {
  if (raw === null || typeof raw !== "object") {
    return;
  }

  const record = raw as Record<string, unknown>;
  const hasTransactionId =
    "txHash" in record || "transactionHash" in record || "hash" in record;
  const hasResult = "result" in record;

  if (hasTransactionId || hasResult) {
    return;
  }

  throw new CaatingaError(
    `Submit returned an unrecognized payload for "${contractName}.${method}".`,
    CaatingaErrorCode.XDR_RESULT_FAILED,
    "Expected txHash, transactionHash, hash, or result on the submit response. Use debugRaw to inspect the binding output."
  );
}

function normalizeSubmitResult<T>(raw: unknown): {
  transactionHash?: string;
  result?: T;
} {
  const candidate = raw as {
    txHash?: string;
    transactionHash?: string;
    hash?: string;
    result?: T;
  };

  return {
    transactionHash: candidate.txHash ?? candidate.transactionHash ?? candidate.hash,
    result: candidate.result
  };
}
