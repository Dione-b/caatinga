/**
 * Source-level edits `ctg zk init` makes to an existing `caatinga.config.ts`:
 * adding the verifier contract entry and the `zk` block. Pure string
 * transformations, kept apart from the command so they can be tested without
 * touching the filesystem.
 */

// The verifier's constructor takes the account allowed to call `upgrade`.
export const ZK_VERIFIER_DEPLOY_ARGS = 'deployArgs: { admin: "${source.address}" }';

const ZK_VERIFIER_LINES = [
  "    verifier: {",
  '      path: "./contracts/verifier",',
  '      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",',
  `      ${ZK_VERIFIER_DEPLOY_ARGS}`,
  "    },",
];

const ZK_VERIFIER_BLOCK = ZK_VERIFIER_LINES.join("\n");

// A flat `verifier: { ... }` entry pointing at the scaffolded contract.
const SCAFFOLD_VERIFIER_ENTRY =
  /(\n([ \t]*)verifier:\s*\{)([^{}]*path:\s*["']\.\/contracts\/verifier["'][^{}]*?)(\n[ \t]*\})/;

const SCAFFOLD_VERIFIER_PATH = /path:\s*["']\.\/contracts\/verifier["']/g;

const ADMIN_DEPLOY_ARG = /deployArgs:\s*\{[^}]*\badmin\b/;

type CharKind = "code" | "string" | "comment";

/**
 * Labels each character of a config source as code, string literal or comment,
 * so braces and commas inside strings and comments are not mistaken for code.
 */
function classifyChars(source: string): CharKind[] {
  const kinds = new Array<CharKind>(source.length).fill("code");
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    let kind: CharKind;
    let end: number;
    if (char === "/" && next === "/") {
      kind = "comment";
      end = source.indexOf("\n", i);
      end = end === -1 ? source.length : end;
    } else if (char === "/" && next === "*") {
      kind = "comment";
      end = source.indexOf("*/", i + 2);
      end = end === -1 ? source.length : end + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      kind = "string";
      end = i + 1;
      while (end < source.length && source[end] !== char) {
        end += source[end] === "\\" ? 2 : 1;
      }
      end = Math.min(end + 1, source.length);
    } else {
      i++;
      continue;
    }
    kinds.fill(kind, i, end);
    i = end;
  }
  return kinds;
}

/**
 * The `{ ... }` object literal that encloses `index`, with comments blanked out,
 * or undefined when `index` is not inside one.
 */
function enclosingObjectLiteral(
  source: string,
  kinds: CharKind[],
  index: number
): string | undefined {
  const opens: number[] = [];
  let start: number | undefined;
  for (let i = 0; i < source.length; i++) {
    if (i === index) {
      start = opens.at(-1);
      if (start === undefined) {
        return undefined;
      }
    }
    if (kinds[i] !== "code") {
      continue;
    }
    if (source[i] === "{") {
      opens.push(i);
    } else if (source[i] === "}" && opens.pop() === start && start !== undefined) {
      let entry = "";
      for (let k = start; k <= i; k++) {
        entry += kinds[k] === "comment" ? " " : source[k];
      }
      return entry;
    }
  }
  return undefined;
}

/**
 * Adds the admin deploy arg to an existing scaffold verifier entry that predates
 * the verifier's `upgrade` entrypoint. Returns the source unchanged when the
 * entry already has deployArgs or is not the flat scaffold shape.
 */
function addVerifierAdminDeployArg(source: string): string {
  return source.replace(
    SCAFFOLD_VERIFIER_ENTRY,
    (match, open: string, indent: string, body: string, close: string) => {
      if (body.includes("deployArgs")) {
        return match;
      }
      // The comma goes after the last code character, never into a trailing
      // `// comment` (where it would leave the config without a separator).
      const kinds = classifyChars(body);
      let last = body.length - 1;
      while (last >= 0 && (kinds[last] === "comment" || /\s/.test(body[last]!))) {
        last--;
      }
      if (last < 0) {
        return match;
      }
      const separator = body[last] === "," ? "" : ",";
      const trailingComments = body.slice(last + 1).trimEnd();
      return `${open}${body.slice(0, last + 1)}${separator}${trailingComments}\n${indent}  ${ZK_VERIFIER_DEPLOY_ARGS}${close}`;
    }
  );
}

/**
 * True when an entry points at the scaffolded verifier but has no admin deploy
 * arg of its own, e.g. a nested or computed entry `addVerifierAdminDeployArg`
 * could not rewrite. Deploying that verifier fails without the constructor arg.
 * Another contract's `deployArgs: { admin }` does not count.
 */
export function scaffoldVerifierLacksAdmin(source: string): boolean {
  const kinds = classifyChars(source);
  for (const match of source.matchAll(SCAFFOLD_VERIFIER_PATH)) {
    if (kinds[match.index] !== "code") {
      continue;
    }
    const entry = enclosingObjectLiteral(source, kinds, match.index);
    if (entry === undefined || !ADMIN_DEPLOY_ARG.test(entry)) {
      return true;
    }
  }
  return false;
}

const ZK_CONFIG_LINES = [
  "  zk: {",
  "    circuits: {",
  "      main: {",
  '        path: "./circuits",',
  '        protocol: "groth16",',
  '        curve: "bls12381",',
  '        verifierContract: "verifier"',
  "      }",
  "    }",
  "  }",
];

const ZK_CONFIG_BLOCK = ZK_CONFIG_LINES.join("\n");

export function mergeZkIntoConfigSource(source: string): { merged: string; changed: boolean } {
  let next = source;

  const needsVerifier = !next.includes("verifier:");
  const needsZk = !next.includes("zk:");

  if (!needsVerifier) {
    next = addVerifierAdminDeployArg(next);
  }

  if (!needsVerifier && !needsZk) {
    return next === source ? { merged: source, changed: false } : { merged: next, changed: true };
  }

  if (needsVerifier) {
    const before = next;
    // Match contracts block closing at 2-space indent (not inner contract entries).
    // The first alternative matches an empty block, including the inline `contracts: {},`.
    next = next.replace(
      /contracts:\s*\{\s*\},|contracts:\s*\{([\s\S]*?)\n {2}\},/,
      (_match, entries: string | undefined) => {
        const body = (entries ?? "").trimEnd();
        // The last entry may lack a trailing comma (e.g. configs written by `ctg init --minimal`).
        const separator = body === "" || body.endsWith(",") ? "" : ",";
        return "contracts: {" + body + separator + "\n" + ZK_VERIFIER_BLOCK + "\n  },";
      }
    );
    if (next === before) {
      return { merged: source, changed: false };
    }
  }

  if (needsZk) {
    const before = next;
    if (/,\n\}\);?\s*$/.test(next)) {
      next = next.replace(/,\n\}\);?\s*$/, ",\n" + ZK_CONFIG_BLOCK + "\n});\n");
    } else {
      next = next.replace(/\n\}\);?\s*$/, ",\n" + ZK_CONFIG_BLOCK + "\n});\n");
    }
    if (next === before) {
      return { merged: source, changed: false };
    }
  }

  const complete = next.includes("verifier:") && next.includes("zk:");
  if (!complete || next === source) {
    return { merged: source, changed: false };
  }

  return { merged: next, changed: true };
}

/**
 * What to add by hand when the config could not be rewritten automatically.
 * Built from the same lines the automatic merge inserts, so the two cannot
 * drift apart.
 */
export function manualZkConfigInstructions(): string[] {
  return [
    '  1. In the "contracts" section, add:',
    ...ZK_VERIFIER_LINES.map((line) => ` ${line}`),
    "",
    "  2. Before the closing });, add:",
    ...ZK_CONFIG_LINES,
    "",
  ];
}
