type TransactionResult = {
  txHash: string;
  result?: unknown;
};

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

  async signAndSend(): Promise<TransactionResult> {
    return {
      txHash: "example-transaction-hash",
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
    return new ExampleTransaction("increment");
  }

  get(): ExampleTransaction {
    return new ExampleTransaction("get", 1);
  }

  describe(): string {
    return `${this.input.contractId}:${this.input.publicKey}`;
  }
}
