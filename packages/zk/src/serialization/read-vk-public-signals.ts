import { readFile } from "node:fs/promises";
import { ZkError } from "../errors/ZkError.js";

/**
 * Reads a snarkjs verification key and returns the number of public signals it
 * was generated for.
 *
 * snarkjs has shipped two spellings of the IC array (`ic` and `vk_ic`) and, in
 * the version Caatinga pins, an explicit `nPublic` field alongside `IC`. All
 * three are accepted so a key produced by any of them works; `nPublic` wins
 * when present because it is authoritative rather than inferred.
 */
export async function readVerificationKeyPublicSignals(vkPath: string): Promise<number> {
  let parsed: { nPublic?: unknown; ic?: unknown[]; vk_ic?: unknown[]; IC?: unknown[] };
  try {
    parsed = JSON.parse(await readFile(vkPath, "utf8")) as typeof parsed;
  } catch (error) {
    throw new ZkError(
      `Could not read the verification key at ${vkPath}.`,
      "ZK_VK_REQUIRED",
      `Run \`ctg zk build\` first so the verification key exists. (${error instanceof Error ? error.message : String(error)})`
    );
  }

  if (
    typeof parsed.nPublic === "number" &&
    Number.isInteger(parsed.nPublic) &&
    parsed.nPublic >= 0
  ) {
    return parsed.nPublic;
  }

  const ic = [parsed.ic, parsed.vk_ic, parsed.IC].find((candidate) => Array.isArray(candidate));

  if (!ic || ic.length < 2) {
    throw new ZkError(
      `The verification key at ${vkPath} has no usable IC array.`,
      "ZK_VK_REQUIRED",
      "Run `ctg zk build` to regenerate the verification key, or import audited ceremony artifacts with `ctg zk import-ceremony`."
    );
  }

  return ic.length - 1;
}
