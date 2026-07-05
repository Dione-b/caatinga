import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CaatingaConfig } from "../config/config.schema.js";

const SOROBAN_SDK_DEPENDENCY_PATTERN =
  /^\s*soroban-sdk\s*=\s*(?:\{[^}]*version\s*=\s*"([^"]+)"|"([^"]+)")/m;

export type ContractSdkVersion = {
  contract: string;
  sorobanSdk?: string;
  cargoPath: string;
};

export async function readContractSorobanSdkVersions(
  config: CaatingaConfig,
  cwd = process.cwd()
): Promise<ContractSdkVersion[]> {
  const versions: ContractSdkVersion[] = [];

  for (const [contract, contractConfig] of Object.entries(config.contracts)) {
    const cargoPath = path.resolve(cwd, contractConfig.path, "Cargo.toml");
    let sorobanSdk: string | undefined;

    try {
      const cargoToml = await readFile(cargoPath, "utf8");
      const match = cargoToml.match(SOROBAN_SDK_DEPENDENCY_PATTERN);
      sorobanSdk = match?.[1] ?? match?.[2];
    } catch {
      sorobanSdk = undefined;
    }

    versions.push({
      contract,
      sorobanSdk,
      cargoPath: path.relative(cwd, cargoPath),
    });
  }

  return versions;
}
