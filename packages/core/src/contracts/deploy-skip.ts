export type SkippedContract = {
  name: string;
  contractId: string;
  network: string;
  reason: "already-deployed";
};

export function toSkippedContract(
  name: string,
  contractId: string,
  network: string
): SkippedContract {
  return {
    name,
    contractId,
    network,
    reason: "already-deployed"
  };
}
