import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const root = process.cwd();

const markdownFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "ROADMAP.md",
  "docs/getting-started.md",
  "docs/cli.md",
  "docs/client.md",
  "docs/config.md",
  "docs/errors.md",
  "docs/release.md",
  "docs/stellar-cli-version-contract.md",
  "examples/counter-web/README.md"
];

const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function validateReadableMarkdown(file, content) {
  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const proseLines = lines.filter((line) => !line.trim().startsWith("|"));
  const longestLine = Math.max(...proseLines.map((line) => line.length));

  if (nonEmptyLines.length < 8) {
    fail(file, "appears compressed; expected at least 8 non-empty lines");
  }

  if (longestLine > 240) {
    fail(file, `contains an overly long line (${longestLine} characters)`);
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

    const absoluteTarget = path.resolve(path.dirname(path.join(root, file)), target);
    if (!existsSync(absoluteTarget)) {
      fail(file, `internal link target does not exist: ${match[1]}`);
    }
  }
}

function validateSourceAccountWording(file, content) {
  const unsafeAcceptance = /--source[^.\n]*(accepts?|use|pass)[^.\n]*(public\s+)?G\.\.\./i;

  if (unsafeAcceptance.test(content)) {
    fail(file, "suggests public G... addresses are accepted for --source");
  }
}

function validateWorkflowYaml(file, content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 5) {
    fail(file, "appears compressed; expected at least 5 non-empty lines");
  }

  try {
    parseYaml(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(file, `invalid YAML: ${message}`);
  }
}

const workflowDir = path.join(root, ".github/workflows");

for (const entry of readdirSync(workflowDir)) {
  if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) continue;

  const file = path.join(".github/workflows", entry);
  validateWorkflowYaml(file, read(file));
}

for (const file of markdownFiles) {
  const content = read(file);

  validateReadableMarkdown(file, content);
  validateCodeFences(file, content);
  validateTables(file, content);
  validateInternalLinks(file, content);
  validateSourceAccountWording(file, content);
}

if (failures.length > 0) {
  console.error("Documentation check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}
