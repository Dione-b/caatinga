import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

/**
 * Stellar strkeys are RFC4648 base32, so the alphabet is A-Z2-7 — digits 0, 1, 8
 * and 9 never appear. Matches the source-account check in recover-deploy-contract-id.
 */
const CONTRACT_ID_REGEX_GLOBAL = /\bC[A-Z2-7]{55}\b/g;

/** e.g. `Contract ID: C...`, `contract_id = "C..."` */
const LABELED_LINE_REGEX = /contract[\s_-]*id\s*[:=]/i;

/** A line holding nothing but the ID, optionally quoted — the CLI's own stdout shape. */
const STANDALONE_LINE_REGEX = /^\s*["']?(C[A-Z2-7]{55})["']?\s*$/;

function lastMatch(line: string): string | undefined {
  const matches = line.match(CONTRACT_ID_REGEX_GLOBAL);
  return matches?.[matches.length - 1];
}

/**
 * Extracts the deployed contract ID from Stellar CLI output.
 *
 * The input is stdout and stderr combined, so a naive "first 56-char C-string
 * anywhere" match can pick up a lookalike token from an earlier warning or
 * diagnostic line and silently persist the wrong contract ID to
 * caatinga.artifacts.json. Instead we prefer the strongest signal available and
 * scan from the end, because the CLI emits the real result last:
 *
 *   1. the last explicitly labeled line (`Contract ID: C...`)
 *   2. the last line consisting solely of a contract ID
 *   3. a bare match anywhere in the output, but only when the whole output
 *      contains exactly one distinct contract ID — with two or more we cannot
 *      tell the deployed one from a lookalike in a warning or an RPC error
 *      body, so we refuse to guess and name the candidates instead.
 */
export function parseContractId(output: string): string {
  const lines = output.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] as string;
    if (LABELED_LINE_REGEX.test(line)) {
      const id = lastMatch(line);
      if (id) {
        return id;
      }
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const standalone = (lines[i] as string).match(STANDALONE_LINE_REGEX);
    if (standalone) {
      return standalone[1] as string;
    }
  }

  const distinctIds = [...new Set(output.match(CONTRACT_ID_REGEX_GLOBAL) ?? [])];
  if (distinctIds.length === 1) {
    return distinctIds[0] as string;
  }

  if (distinctIds.length > 1) {
    throw new CaatingaError(
      `Found ${distinctIds.length} contract IDs in Stellar CLI output and none on a labeled or standalone line.`,
      CaatingaErrorCode.CONTRACT_ID_NOT_FOUND,
      [
        "Refusing to guess which one was deployed — the wrong ID would be persisted to caatinga.artifacts.json and become the target of every later invoke, read, upgrade and wire.",
        `Candidates: ${distinctIds.join(", ")}.`,
        "Confirm the deployed ID on a block explorer and set it in caatinga.artifacts.json, or report the CLI output format if this is a false alarm.",
      ].join(" ")
    );
  }

  throw new CaatingaError(
    "Could not find contract ID in Stellar CLI output.",
    CaatingaErrorCode.CONTRACT_ID_NOT_FOUND,
    "Check whether the Stellar CLI output format changed."
  );
}
