import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { assertSafeSourceAccount } from "./source-account.js";

const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

export async function resolveSourceAddress(options: {
  source: string;
  cwd?: string;
}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const source = assertSafeSourceAccount(options.source);

  await checkBinary("stellar", "Install Stellar CLI before resolving the deploy source address.");

  let result: Awaited<ReturnType<typeof runCommand>>;
  try {
    result = await runCommand("stellar", ["keys", "address", source], {
      cwd,
      failureCode: CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
    });
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw new CaatingaError(
        `Could not resolve address for source "${source}".`,
        CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
        `Create the identity first: stellar keys generate ${source} --fund --network testnet`,
        error
      );
    }
    throw error;
  }

  const address = (result.stdout || result.all || "").trim();
  if (!STELLAR_ADDRESS_REGEX.test(address)) {
    throw new CaatingaError(
      `Stellar CLI returned an invalid address for source "${source}".`,
      CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
      `Verify the identity exists: stellar keys address ${source}`
    );
  }

  return address;
}
