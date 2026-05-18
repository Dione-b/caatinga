export const templateId = "marketplace-with-token";

export function describeDeployFlow(): string {
  return [
    "1. caatinga build token",
    "2. caatinga build marketplace",
    "3. caatinga deploy --network testnet --source <identity>",
    "4. caatinga generate token",
    "5. caatinga generate marketplace",
    "marketplace.deployArgs.tokenContractId resolves from caatinga.artifacts.json and is passed to __constructor"
  ].join("\n");
}
