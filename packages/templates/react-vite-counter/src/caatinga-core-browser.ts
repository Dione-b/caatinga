export const CaatingaErrorCode = {
  CONTRACT_NOT_FOUND: "CAATINGA_CONTRACT_NOT_FOUND",
  CONTRACT_ARTIFACT_NOT_FOUND: "CAATINGA_CONTRACT_ARTIFACT_NOT_FOUND",
  BINDING_CLIENT_NOT_FOUND: "CAATINGA_BINDING_CLIENT_NOT_FOUND",
  BINDING_METHOD_NOT_FOUND: "CAATINGA_BINDING_METHOD_NOT_FOUND",
  XDR_BUILD_FAILED: "CAATINGA_XDR_BUILD_FAILED",
  XDR_PREPARE_FAILED: "CAATINGA_XDR_PREPARE_FAILED",
  XDR_SIGN_FAILED: "CAATINGA_XDR_SIGN_FAILED",
  XDR_SUBMIT_FAILED: "CAATINGA_XDR_SUBMIT_FAILED",
  XDR_RESULT_FAILED: "CAATINGA_XDR_RESULT_FAILED",
  WALLET_NOT_CONNECTED: "CAATINGA_WALLET_NOT_CONNECTED"
} as const;

export class CaatingaError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "CaatingaError";
  }
}

export type CaatingaArtifacts = {
  project: string;
  version: 1;
  networks: Record<
    string,
    {
      contracts: Record<
        string,
        {
          contractId: string;
          wasmHash: string;
          deployedAt: string;
          sourcePath: string;
          wasmPath: string;
          dependencies: string[];
          resolvedDeployArgs: Record<string, string | number | boolean>;
        }
      >;
      dependencyGraph: Record<string, string[]>;
    }
  >;
};
