import { createHash, randomBytes } from "node:crypto";

/**
 * Stdin for a single-party snarkjs `contribute` step: the contribution name,
 * then fresh entropy. Used by the dev powers-of-tau and the dev trusted setup,
 * neither of which is safe for production.
 */
export function devContributionInput(): string {
  const entropy = createHash("sha256").update(randomBytes(32)).digest("hex");
  return `caatinga-dev\n${entropy}\n`;
}
