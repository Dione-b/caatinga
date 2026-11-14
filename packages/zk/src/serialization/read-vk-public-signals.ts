import { readJsonFile } from "../artifacts/files.js";
import { ZkError } from "../errors/ZkError.js";

/** The fields of a snarkjs verification key that say how many public signals it has. */
export type VkPublicSignalFields = {
  nPublic?: unknown;
  ic?: unknown[];
  vk_ic?: unknown[];
  IC?: unknown[];
};

/**
 * Explicit public-signal count of a verification key, when it declares one.
 * Authoritative when present, since it is stated rather than inferred.
 */
export function declaredPublicSignals(vk: VkPublicSignalFields): number | undefined {
  return typeof vk.nPublic === "number" && Number.isInteger(vk.nPublic) && vk.nPublic >= 0
    ? vk.nPublic
    : undefined;
}

/**
 * The IC array of a verification key, or undefined when it has no usable one.
 * snarkjs has shipped three spellings (`ic`, `vk_ic`, `IC`); an IC always
 * holds one point more than the circuit has public signals.
 */
export function usableIc(vk: VkPublicSignalFields): unknown[] | undefined {
  const ic = [vk.ic, vk.vk_ic, vk.IC].find((candidate) => Array.isArray(candidate));
  return ic && ic.length >= 2 ? ic : undefined;
}

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
  let parsed: VkPublicSignalFields;
  try {
    parsed = await readJsonFile<VkPublicSignalFields>(vkPath);
  } catch (error) {
    throw new ZkError(
      `Could not read the verification key at ${vkPath}.`,
      "ZK_VK_REQUIRED",
      `Run \`ctg zk build\` first so the verification key exists. (${error instanceof Error ? error.message : String(error)})`
    );
  }

  const declared = declaredPublicSignals(parsed);
  if (declared !== undefined) {
    return declared;
  }

  const ic = usableIc(parsed);
  if (!ic) {
    throw new ZkError(
      `The verification key at ${vkPath} has no usable IC array.`,
      "ZK_VK_REQUIRED",
      "Run `ctg zk build` to regenerate the verification key, or import audited ceremony artifacts with `ctg zk import-ceremony`."
    );
  }

  return ic.length - 1;
}
