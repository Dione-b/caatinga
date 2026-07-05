/**
 * App-layer E2E stub — outside Caatinga on-chain scope.
 *
 * Caatinga validates build, deploy, bindings, and direct contract invoke/read.
 * This file is a placeholder for your stack (Express, NestJS, etc.) to verify:
 * - REST handlers persist tx hashes
 * - async jobs surface errors to callers
 * - server-side invoke uses the expected signing identity
 *
 * Replace with real tests using your HTTP client and database fixtures.
 */

export type AppE2EChecklist = {
  persistsTxHash: boolean;
  pollsSubmissionStatus: boolean;
  usesExpectedServerIdentity: boolean;
};

export const defaultAppE2EChecklist: AppE2EChecklist = {
  persistsTxHash: false,
  pollsSubmissionStatus: false,
  usesExpectedServerIdentity: false,
};

export function describeAppE2EGap(): string {
  return "Caatinga green does not imply app green — implement HTTP/DB/async checks separately.";
}
