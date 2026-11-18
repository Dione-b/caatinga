export class ZkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly hint?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ZkError";
  }
}
