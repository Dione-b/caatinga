import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();

const criticalMarkdownFiles = {
  "README.md": { minNonEmptyLines: 80 },
  "ROADMAP.md": { minNonEmptyLines: 20 },
  "docs/release.md": { minNonEmptyLines: 25 },
  "docs/getting-started.md": { minNonEmptyLines: 30 },
  "docs/tutorials/from-zero-to-testnet.md": { minNonEmptyLines: 40 },
  "examples/counter-web/README.md": { minNonEmptyLines: 25 },
};

const extendedMarkdownFiles = [
  "CONTRIBUTING.md",
  "AGENTS.md",
  "docs/cli.md",
  "docs/client.md",
  "docs/config.md",
  "docs/errors.md",
  "docs/stellar-cli-version-contract.md",
];

const criticalJsonFiles = [
  "package.json",
  "packages/cli/package.json",
  "packages/core/package.json",
  "packages/client/package.json",
  "examples/counter-web/package.json",
];

const criticalYamlFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/release-gate.yml",
  ".github/workflows/testnet-smoke.yml",
];

const MAX_PROSE_LINE_LENGTH = 300;
const MIN_DOCS_CHECK_LINES = 20;
const MIN_WORKFLOW_NON_EMPTY_LINES = 10;
const MIN_EXTENDED_MARKDOWN_NON_EMPTY_LINES = 8;

const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function read(filePath) {
  return readFileSync(path.join(ROOT, filePath), "utf8");
}

function countNonEmptyLines(content) {
  return content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function isLongLineExempt(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("|")) return true;
  if (/https?:\/\//.test(line)) return true;
  if (/\[!\[[^\]]*\]\([^)]+\)/.test(line)) return true;
  if (trimmed.startsWith("![")) return true;
  return false;
}

function validateMarkdownLineLength(file, content) {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length <= MAX_PROSE_LINE_LENGTH) continue;
    if (isLongLineExempt(line)) continue;

    fail(
      file,
      `line ${index + 1} exceeds ${MAX_PROSE_LINE_LENGTH} characters (${line.length})`,
    );
  }
}

function validateMarkdownDensity(file, content, minNonEmptyLines) {
  const nonEmptyLines = countNonEmptyLines(content);

  if (nonEmptyLines < minNonEmptyLines) {
    fail(
      file,
      `appears compressed; expected at least ${minNonEmptyLines} non-empty lines (found ${nonEmptyLines})`,
    );
  }
}

function validateCodeFences(file, content) {
  const fenceCount = [...content.matchAll(/^```/gm)].length;

  if (fenceCount % 2 !== 0) {
    fail(file, "has an unclosed fenced code block");
  }
}

function validateTables(file, content) {
  const lines = content.split(/\r?\n/);

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)) continue;

    const previous = lines[index - 1].trim();
    if (!previous.includes("|")) {
      fail(file, `table separator on line ${index + 1} does not follow a table header`);
    }
  }
}

function validateInternalLinks(file, content) {
  const linkPattern = /\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g;

  for (const match of content.matchAll(linkPattern)) {
    const target = match[1].split("#")[0];
    if (!target) continue;

    const absoluteTarget = path.resolve(path.dirname(path.join(ROOT, file)), target);
    if (!existsSync(absoluteTarget)) {
      fail(file, `internal link target does not exist: ${match[1]}`);
    }
  }
}

const unsafeSourcePatterns = [
  /--source[^.\n]*(accepts?|use|pass)[^.\n]*(public\s+)?G/i,
  /--source accepts public G address/i,
  /--source accepts G\.\.\./i,
  /source can be public address/i,
  /source may be account id/i,
];

function validateSourceAccountWording(file, content) {
  for (const pattern of unsafeSourcePatterns) {
    if (pattern.test(content)) {
      fail(file, "suggests public G... addresses or account ids are accepted for --source");
    }
  }
}

function validatePackageJson(file, content) {
  const trimmed = content.trim();

  if (!trimmed.includes("\n")) {
    fail(file, "appears minified; expected multi-line JSON with 2-space indentation");
  }

  try {
    JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(file, `invalid JSON: ${message}`);
  }
}

function validateDocsCheckScript(file, content) {
  const nonEmptyLines = countNonEmptyLines(content);
  const longestLine = Math.max(...content.split(/\r?\n/).map((line) => line.length), 0);

  if (nonEmptyLines < MIN_DOCS_CHECK_LINES) {
    fail(
      file,
      `appears compressed; expected at least ${MIN_DOCS_CHECK_LINES} non-empty lines`,
    );
  }

  if (longestLine > 500) {
    fail(file, "appears compressed on a single line");
  }
}

function validateWorkflowYaml(file, content) {
  const nonEmptyLines = countNonEmptyLines(content);

  if (nonEmptyLines < MIN_WORKFLOW_NON_EMPTY_LINES) {
    fail(
      file,
      `appears compressed; expected at least ${MIN_WORKFLOW_NON_EMPTY_LINES} non-empty lines`,
    );
  }

  try {
    parseYaml(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(file, `invalid YAML: ${message}`);
  }
}

function validateMarkdownFile(file, minNonEmptyLines) {
  const content = read(file);

  validateMarkdownDensity(file, content, minNonEmptyLines);
  validateMarkdownLineLength(file, content);
  validateCodeFences(file, content);
  validateTables(file, content);
  validateInternalLinks(file, content);
  validateSourceAccountWording(file, content);
}

for (const [file, rules] of Object.entries(criticalMarkdownFiles)) {
  validateMarkdownFile(file, rules.minNonEmptyLines);
}

for (const file of extendedMarkdownFiles) {
  validateMarkdownFile(file, MIN_EXTENDED_MARKDOWN_NON_EMPTY_LINES);
}

for (const file of criticalJsonFiles) {
  validatePackageJson(file, read(file));
}

for (const file of criticalYamlFiles) {
  validateWorkflowYaml(file, read(file));
}

const workflowDir = path.join(ROOT, ".github/workflows");

for (const entry of readdirSync(workflowDir)) {
  if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) continue;

  const file = path.join(".github/workflows", entry);
  if (criticalYamlFiles.includes(file)) continue;

  validateWorkflowYaml(file, read(file));
}

validateDocsCheckScript("scripts/docs-check.mjs", read("scripts/docs-check.mjs"));

if (failures.length > 0) {
  console.error("Documentation check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}
