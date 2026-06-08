type TransactionResult = {
  txHash: string;
  result?: unknown;
};

type SignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }> | { signedTxXdr: string };

class ExampleTransaction {
  constructor(
    private readonly method: string,
    private readonly result?: unknown
  ) {}

  toXDR(): string {
    return `example-${this.method}-xdr`;
  }

  async prepare(): Promise<ExampleTransaction> {
    return this;
  }

  async signAndSend(input?: { signTransaction?: SignTransaction }): Promise<TransactionResult> {
    const signed = input?.signTransaction
      ? await input.signTransaction(this.toXDR())
      : { signedTxXdr: this.toXDR() };

    return {
      txHash: `example-transaction-hash:${signed.signedTxXdr}`,
      result: this.result
    };
  }
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

  increment(): ExampleTransaction {
    return new ExampleTransaction("increment", 1);
  }

  get(): ExampleTransaction {
    return new ExampleTransaction("get", 1);
  }

  describe(): string {
    return `${this.input.contractId}:${this.input.publicKey}`;
  }
}
