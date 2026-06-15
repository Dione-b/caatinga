export class ZkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "ZkError";
  }
}
