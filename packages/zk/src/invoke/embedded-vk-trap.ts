import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import { readFile } from "node:fs/promises";
import { embeddedVkSourcePath } from "../artifacts/zk-paths.js";
import { isPlaceholderEmbeddedVk } from "../build/embedded-vk.js";
import { collectErrorText } from "../errors/error-text.js";

export const EMBEDDED_VK_METHOD = "verify_proof_embedded";

/**
 * Markers of a VM trap in Stellar CLI output. The diagnostic event naming
 * `UnreachableCodeReached` is printed only at some verbosity levels (CLI 28.1
 * shows it only with `-v`); by default the CLI reports just the host error
 * `Error(WasmVm, InvalidAction)`, which is what a trap surfaces as.
 */
const VM_TRAP_MARKERS = ["UnreachableCodeReached", "Error(WasmVm, InvalidAction)"];

/**
 * The output lines reporting a VM trap in `verify_proof_embedded`, or none when
 * the failure is something else. Searches the error and its causes, since
 * `invokeContract` may re-wrap the Stellar CLI failure and move its output
 * (kept in `hint`) down into the cause.
 */
export function embeddedVkTrapLines(error: unknown): string[] {
  if (!(error instanceof Error)) {
    return [];
  }
  const text = collectErrorText(error);
  if (!text.includes(EMBEDDED_VK_METHOD)) {
    return [];
  }
  const trapLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => VM_TRAP_MARKERS.some((marker) => line.includes(marker)));
  return [...new Set(trapLines)];
}

/**
 * A trap in `verify_proof_embedded` is most often the scaffold's placeholder
 * `embedded_vk()`, which panics on purpose — but any panic in the contract looks
 * the same on chain, so the error says "likely" and the local `vk.rs` decides
 * which step the user is missing. The trap itself stays in the hint and the
 * original error stays as the cause, for when the guess is wrong.
 */
export async function embeddedVkTrapError(
  verifierContract: string,
  cwd: string,
  cause: unknown,
  trapLines: string[]
): Promise<CaatingaError> {
  const message = `${EMBEDDED_VK_METHOD} trapped on "${verifierContract}", most likely because the deployed verifier still carries the placeholder verification key.`;
  const nextStep = (await localVkIsPlaceholder(cwd))
    ? "contracts/verifier/src/vk.rs is still the placeholder. Run `ctg zk build <circuit> --embed-vk`, then `ctg build verifier` and `ctg upgrade verifier --source <admin>`, then invoke again (a verifier deployed without an upgrade entrypoint needs one `ctg deploy verifier --upgrade`)."
    : "contracts/verifier/src/vk.rs has a real key, so the deployed contract is likely older than it. Run `ctg build verifier` and `ctg upgrade verifier --source <admin>`, then invoke again (a verifier deployed without an upgrade entrypoint needs one `ctg deploy verifier --upgrade`). If it still traps, the panic comes from the contract code itself.";
  return new CaatingaError(
    message,
    CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
    [nextStep, "Stellar CLI reported:", ...trapLines].join("\n"),
    cause
  );
}

async function localVkIsPlaceholder(cwd: string): Promise<boolean> {
  try {
    return isPlaceholderEmbeddedVk(await readFile(embeddedVkSourcePath(cwd), "utf8"));
  } catch {
    // No vk.rs at all means it was never generated either.
    return true;
  }
}
