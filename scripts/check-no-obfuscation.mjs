#!/usr/bin/env node
// Supply-chain guard: fails CI when a tracked file contains obfuscated or dynamically
// executed code, hidden Unicode, install-time hooks, or non-registry dependencies.
//
// Caatinga ships a CLI that runs on developer machines and holds Stellar signing
// identities, and most of its PRs come from outside contributors. Obfuscation has no
// legitimate use in this repository, so the patterns below are blocked outright
// rather than reviewed case by case. A genuine exception goes into ALLOWLIST with a
// reason; this file is covered by CODEOWNERS, so every exception gets a maintainer
// review.
//
// Usage: node scripts/check-no-obfuscation.mjs [file...]
//   With no arguments, every file tracked by git is checked.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".sh",
  ".rs",
  ".py",
  ".yml",
  ".yaml",
  ".html",
  ".vue",
]);

/** Native executables and archives: nothing in this repository should commit them. */
const BINARY_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".bin",
  ".jar",
  ".class",
  ".pyc",
  ".tgz",
  ".zip",
  ".7z",
]);

/** Release history quotes old commands (e.g. the removed curl-to-shell installer). */
const HISTORY_FILES = /(^|\/)CHANGELOG\.md$/;

const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublish",
  "preprepare",
  "postprepare",
  "preuninstall",
  "uninstall",
  "postuninstall",
]);

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "resolutions",
];

/**
 * Reviewed exceptions: `rule` is a rule id below, `path` a repo-relative path, and `match`
 * (optional) a substring the offending text must contain.
 */
const ALLOWLIST = [
  {
    rule: "non-registry-dependency",
    path: /^packages\/templates\/[^/]+\/package\.json$/,
    match: "file:./src/stubs/",
    reason:
      "Wallet SDK stubs required by the template install-override contract (docs/internal/template-overrides.md).",
  },
];

const HIDDEN_UNICODE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;

/** Each rule applies to one line of a code file. */
const LINE_RULES = [
  {
    id: "dynamic-code-execution",
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bvm\s*\.\s*(runIn\w+|Script|compileFunction)\b/,
    message: "dynamic code execution (eval / Function constructor / vm)",
  },
  {
    id: "string-timer-execution",
    pattern: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/,
    message: "timer called with a code string",
  },
  {
    id: "escaped-byte-run",
    pattern: /(?:\\x[0-9a-fA-F]{2}){4,}|(?:\\u00[0-9a-fA-F]{2}){4,}/,
    message: "run of \\x / \\u escapes (encoded payload)",
  },
  {
    id: "char-code-payload",
    pattern: /fromCharCode\s*\(\s*(?:\.\.\.|(?:[^,()]+,){3})/,
    message: "String.fromCharCode building a string from a list of codes",
  },
  {
    id: "encoded-blob",
    pattern: /[A-Za-z0-9+/]{160,}={0,2}|[0-9a-fA-F]{160,}/,
    message: "long base64/hex literal (embedded payload)",
  },
  {
    id: "pipe-to-shell",
    pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/,
    message: "remote script piped into a shell",
    alsoInDocs: true,
  },
];

const MAX_CODE_LINE_LENGTH = 500;

const findings = [];

function report(rule, file, line, detail) {
  const allowed = ALLOWLIST.some(
    (entry) =>
      entry.rule === rule && entry.path.test(file) && (!entry.match || detail.includes(entry.match))
  );
  if (!allowed) {
    findings.push({ rule, file, line, detail });
  }
}

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function isNativeExecutable(buffer) {
  const magic = buffer.subarray(0, 4).toString("hex");
  return (
    magic === "7f454c46" || // ELF
    magic.startsWith("4d5a") || // PE (MZ)
    ["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe"].includes(magic) // Mach-O
  );
}

function checkPackageJson(file, text) {
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return;
  }
  for (const name of Object.keys(pkg.scripts ?? {})) {
    if (LIFECYCLE_SCRIPTS.has(name)) {
      report("lifecycle-script", file, 0, `scripts.${name}: ${pkg.scripts[name]}`);
    }
  }
  for (const field of DEPENDENCY_FIELDS) {
    const walk = (deps, prefix) => {
      for (const [name, spec] of Object.entries(deps ?? {})) {
        if (spec && typeof spec === "object") {
          walk(spec, `${prefix}${name}>`);
        } else if (
          typeof spec === "string" &&
          /^(git[+:]|github:|gitlab:|bitbucket:|https?:|file:|link:)|^[\w-]+\/[\w.-]+(#.*)?$/.test(
            spec
          )
        ) {
          report("non-registry-dependency", file, 0, `${field}.${prefix}${name}: ${spec}`);
        }
      }
    };
    walk(pkg[field], "");
  }
}

function checkFile(file) {
  const absolute = path.join(ROOT, file);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    return;
  }
  if (!stat.isFile()) {
    return;
  }

  const ext = path.extname(file).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    report("binary-file", file, 0, `native binary or archive (${ext})`);
    return;
  }

  const buffer = readFileSync(absolute);
  if (isNativeExecutable(buffer)) {
    report("binary-file", file, 0, "native executable header");
    return;
  }
  if (buffer.includes(0)) {
    return; // Other binary assets (images, wasm fixtures, zkeys) are out of scope here.
  }

  const text = buffer.toString("utf8");
  const lines = text.split("\n");
  const isCode = CODE_EXTENSIONS.has(ext) || /^#!/.test(text);
  const isHistory = HISTORY_FILES.test(file);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const hidden = HIDDEN_UNICODE.exec(line);
    if (hidden) {
      const codePoint = hidden[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
      report("hidden-unicode", file, lineNumber, `U+${codePoint} (invisible / bidi control)`);
    }
    if (isHistory) {
      return;
    }
    for (const rule of LINE_RULES) {
      if ((isCode || rule.alsoInDocs) && rule.pattern.test(line)) {
        report(rule.id, file, lineNumber, `${rule.message}: ${line.trim().slice(0, 120)}`);
      }
    }
    if (isCode && line.length > MAX_CODE_LINE_LENGTH) {
      report("long-line", file, lineNumber, `${line.length} chars (minified or packed code)`);
    }
  });

  if (/\.min\.(js|mjs|cjs)$/.test(file)) {
    report("minified-file", file, 0, "committed minified bundle");
  }
  if (ext === ".svg" && /<script\b|\son[a-z]+\s*=/i.test(text)) {
    report("svg-script", file, 0, "SVG with script or event handler");
  }
  if (path.basename(file) === "package.json") {
    checkPackageJson(file, text);
  }
  if (
    path.basename(file) === "pnpm-lock.yaml" &&
    /resolution: \{(tarball|repo|type: git)/.test(text)
  ) {
    report(
      "non-registry-dependency",
      file,
      0,
      "lockfile resolves a package outside the npm registry"
    );
  }
}

const files = process.argv.length > 2 ? process.argv.slice(2) : trackedFiles();
for (const file of files) {
  checkFile(path.relative(ROOT, path.resolve(ROOT, file)));
}

if (findings.length > 0) {
  console.error(`check-no-obfuscation: ${findings.length} finding(s)\n`);
  for (const { rule, file, line, detail } of findings) {
    console.error(`  [${rule}] ${file}${line ? `:${line}` : ""}  ${detail}`);
  }
  console.error(
    "\nObfuscated code, hidden Unicode, install hooks and non-registry dependencies are blocked." +
      "\nIf this is a reviewed exception, add it to ALLOWLIST in scripts/check-no-obfuscation.mjs."
  );
  process.exit(1);
}

console.log(`check-no-obfuscation: ${files.length} file(s) clean`);
