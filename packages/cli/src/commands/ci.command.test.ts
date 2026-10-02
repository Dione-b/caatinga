import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { execa } from "execa";
import { registerCiCommand } from "./ci.command.js";

vi.mock("execa", () => ({ execa: vi.fn() }));

vi.mock("@caatinga/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@caatinga/core")>()),
  loadConfig: vi.fn(async () => ({})),
  resolveNetwork: vi.fn(() => ({ name: "testnet", origin: "config" })),
}));

const execaMock = vi.mocked(execa);

/**
 * `ctg ci run` used to spawn `node ./dist/index.js` and `pnpm dev`, which only exist
 * inside the Caatinga monorepo, and swallowed a real doctor failure by retrying (#232).
 */
describe("ctg ci run", () => {
  const originalArgv1 = process.argv[1];

  beforeEach(() => {
    execaMock.mockReset();
    process.argv[1] = "/usr/lib/node_modules/@caatinga/cli/dist/index.js";
    process.exitCode = undefined;
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv[1] = originalArgv1;
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  function exitCodes(...codes: number[]): void {
    for (const code of codes) {
      execaMock.mockResolvedValueOnce({ exitCode: code } as never);
    }
  }

  async function run(args: string[] = []): Promise<void> {
    const program = new Command().exitOverride();
    registerCiCommand(program);
    await program.parseAsync(["node", "ctg", "ci", "run", ...args]);
  }

  it("should_rerun_the_current_ctg_binary_for_doctor_and_smoke", async () => {
    exitCodes(0, 0);

    await run(["--source", "deployer"]);

    expect(execaMock.mock.calls.map(([file, args]) => [file, args])).toEqual([
      [process.execPath, [process.argv[1], "doctor", "--network", "testnet"]],
      [
        process.execPath,
        [process.argv[1], "smoke", "--network", "testnet", "--source", "deployer"],
      ],
    ]);
    expect(process.exitCode).toBeUndefined();
  });

  it("should_stop_and_propagate_a_doctor_failure_without_retrying", async () => {
    exitCodes(1);

    await run();

    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });

  it("should_propagate_a_smoke_failure", async () => {
    exitCodes(0, 1);

    await run();

    expect(execaMock).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(1);
  });

  it("should_skip_smoke_when_requested", async () => {
    exitCodes(0);

    await run(["--skip-smoke", "--strict"]);

    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock.mock.calls[0]?.[1]).toEqual([
      process.argv[1],
      "doctor",
      "--network",
      "testnet",
      "--strict",
    ]);
  });
});
