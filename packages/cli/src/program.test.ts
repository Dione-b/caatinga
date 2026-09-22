import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "./program.js";
import chalk from "chalk";

// Keep the release-channel advisory (npm dist-tags lookup) out of these tests.
vi.mock("./commands/doctor-cli-version.js", () => ({
  reportCliVersionChannel: vi.fn().mockResolvedValue(undefined),
}));

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
    expect(commandNames).not.toContain("setup");
  });

  it("should_expose_ctg_bin_alias_alongside_caatinga", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(__dirname, "../package.json"), "utf8")
    ) as { bin: Record<string, string> };

    expect(packageJson.bin).toEqual({
      caatinga: "./dist/index.js",
      ctg: "./dist/index.js",
    });
  });

  it("should_use_invoked_binary_name_in_help_when_argv_is_ctg", () => {
    const originalArgv = process.argv;

    try {
      process.argv = ["node", "/usr/local/bin/ctg"];
      const program = createProgram();

      expect(program.name()).toBe("ctg");
      expect(program.helpInformation()).toContain("ctg [options] [command]");
    } finally {
      process.argv = originalArgv;
    }
  });

  it("should_use_caatinga_name_when_argv_points_at_index_entry", () => {
    const originalArgv = process.argv;

    try {
      process.argv = ["node", "/home/x/node_modules/@caatinga/cli/dist/index.js"];
      const program = createProgram();

      expect(program.name()).toBe("caatinga");
      expect(program.helpInformation()).toContain("caatinga [options] [command]");
      expect(program.helpInformation()).not.toContain("index [options] [command]");
    } finally {
      process.argv = originalArgv;
    }
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
      expect(logSpy).toHaveBeenCalledWith(`${chalk.blue("ℹ")}   npx ctg build    counter`);
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

  describe("subcommand help", () => {
    const collectCommandPaths = (command: Command, prefix: string[] = []): string[][] =>
      command.commands.flatMap((subCommand) => {
        const commandPath = [...prefix, subCommand.name()];
        return [commandPath, ...collectCommandPaths(subCommand, commandPath)];
      });

    const commandPaths = collectCommandPaths(createProgram());

    it("registers subcommands to exercise help for", () => {
      expect(commandPaths.length).toBeGreaterThan(20);
      expect(commandPaths).toEqual(expect.arrayContaining([["init"], ["read"], ["zk", "init"]]));
    });

    it.each(commandPaths.map((commandPath) => [commandPath.join(" "), commandPath]))(
      "renders help for '%s' without recursing",
      (label, commandPath) => {
        const program = createProgram();
        const command = commandPath.reduce<Command>((parent, name) => {
          const match = parent.commands.find((candidate) => candidate.name() === name);
          expect(match, `missing command: ${label}`).toBeDefined();
          return match as Command;
        }, program);

        const helpInformation = command.helpInformation();

        expect(helpInformation).toContain("Usage:");
        expect(helpInformation).toContain(commandPath[commandPath.length - 1]);
        expect(helpInformation).not.toContain("Commands (by domain):");
      }
    );

    // `dev` is a hidden pre-v1 stub that opts out of `--help` via `helpOption(false)`.
    const helpFlagPaths = commandPaths.filter((commandPath) => commandPath[0] !== "dev");

    it.each(helpFlagPaths.map((commandPath) => [commandPath.join(" "), commandPath]))(
      "'%s --help' exits cleanly instead of throwing CAATINGA_UNEXPECTED_ERROR",
      async (_label, commandPath) => {
        const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

        // `exitOverride` is per-command, so opt every subcommand out of process.exit.
        const exitOverrideDeep = (command: Command): Command => {
          command.exitOverride();
          command.commands.forEach(exitOverrideDeep);
          return command;
        };

        try {
          await expect(
            exitOverrideDeep(createProgram()).parseAsync([
              "node",
              "caatinga",
              ...commandPath,
              "--help",
            ])
          ).rejects.toMatchObject({ code: "commander.helpDisplayed" });

          const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
          expect(output).toContain("Usage:");
          expect(output).not.toContain("Maximum call stack size exceeded");
        } finally {
          writeSpy.mockRestore();
        }
      }
    );
  });

  it("prints CLI version via version command", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(__dirname, "../package.json"), "utf8")
    ) as { version: string };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createProgram().exitOverride().parseAsync(["node", "caatinga", "version"]);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`@caatinga/cli: ${packageJson.version}`)
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
