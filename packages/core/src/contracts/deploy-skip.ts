export type SkippedContract = {
  name: string;
  contractId: string;
  network: string;
  /**
   * Why the contract was skipped:
   * - `already-deployed`: an artifact already existed and `ifChanged` was off.
   * - `unchanged-wasm`: `ifChanged` was on and the local WASM hash matched.
   */
  reason: "already-deployed" | "unchanged-wasm";
};

export function toSkippedContract(
  name: string,
  contractId: string,
  network: string,
  reason: SkippedContract["reason"] = "already-deployed"
): SkippedContract {
  return {
    name,
    contractId,
    network,
    reason,
  };
}
