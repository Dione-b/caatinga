import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "./program.js";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("createProgram", () => {
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }

    delete process.env.CAATINGA_TEMPLATES_DIR;
  });

  it("registers the MVP commands", () => {
    const commandNames = createProgram().commands.map((command) => command.name());

    expect(commandNames).toEqual(
      expect.arrayContaining([
        "init",
        "dev",
        "doctor",
        "build",
        "deploy",
        "generate",
        "invoke",
        "read",
        "status",
        "wire",
        "sync-env",
        "smoke",
        "regression",
        "ci",
        "identity",
        "version",
      ])
    );
  });

  it("reports the package version", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(__dirname, "../package.json"), "utf8")
    ) as { version: string };

    expect(createProgram().version()).toBe(packageJson.version);
  });

  it("uses the target directory basename as project name when init receives an absolute path", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-cli-init-"));
    process.env.CAATINGA_TEMPLATES_DIR = path.resolve(__dirname, "../../templates");
    const targetDir = path.join(tmpDir, "absolute-path-app");

    await createProgram().exitOverride().parseAsync(["node", "caatinga", "init", targetDir]);

    const packageJson = JSON.parse(
      await readFile(path.join(targetDir, "package.json"), "utf8")
    ) as { name: string };
    const artifacts = JSON.parse(
      await readFile(path.join(targetDir, "caatinga.artifacts.json"), "utf8")
    ) as { project: string };

    expect(packageJson.name).toBe("absolute-path-app");
    expect(artifacts.project).toBe("absolute-path-app");

    const config = await readFile(path.join(targetDir, "caatinga.config.ts"), "utf8");
    expect(config).toContain("target/wasm32v1-none/release/counter.wasm");
    expect(config).not.toContain("wasm32-unknown-unknown");
  });

  it("prints the template default contract in init next steps", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-cli-init-"));
    process.env.CAATINGA_TEMPLATES_DIR = path.resolve(__dirname, "../../templates");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createProgram()
        .exitOverride()
        .parseAsync([
          "node",
          "caatinga",
          "init",
          path.join(tmpDir, "my-dapp"),
          "--template",
          "react-vite-counter",
        ]);
      expect(logSpy).toHaveBeenCalledWith(`${chalk.blue("ℹ")}   npx caatinga build    counter`);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("formats the help output categorized by domains", () => {
    const program = createProgram();
    const helpInformation = program.helpInformation();

    expect(helpInformation).toContain("Scaffolding & Setup:");
    expect(helpInformation).toContain("Deployment & Lifecycle:");
    expect(helpInformation).toContain("Query & Execution:");
    expect(helpInformation).toContain("Status & Diagnostics:");
    expect(helpInformation).toContain("Zero-Knowledge (ZK) Proofs:");
    expect(helpInformation).toContain("Automation & CI:");
  });

  it("prints CLI version via version command", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(__dirname, "../package.json"), "utf8")
    ) as { version: string };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createProgram().exitOverride().parseAsync(["node", "caatinga", "version"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`@caatinga/cli: ${packageJson.version}`));
    } finally {
      logSpy.mockRestore();
    }
  });
});
