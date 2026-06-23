import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import {
  checkNodeStep,
  createIdentityStep,
  installRustStep,
  installStellarCliStep,
  installWasmTargetStep,
  registerSetupCommand,
  runSetup,
} from "./setup.command.js";

// ─── Module mocks ────────────────────────────────────────────────────────────

const runCommandMock = vi.hoisted(() => vi.fn());
const execaMock = vi.hoisted(() => vi.fn());
const checkStellarCliVersionMock = vi.hoisted(() => vi.fn());
const httpsGetMock = vi.hoisted(() => vi.fn());
const fsWriteFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const fsUnlinkMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    runCommand: runCommandMock,
    checkStellarCliVersion: checkStellarCliVersionMock,
    // Keep PATH resolution cheap and deterministic in tests.
    resolveSubprocessEnv: () => ({}),
  };
});

vi.mock("execa", () => ({ execa: execaMock }));

vi.mock("node:https", () => ({
  default: { get: httpsGetMock },
  get: httpsGetMock,
}));

vi.mock("node:fs/promises", () => ({
  writeFile: fsWriteFileMock,
  unlink: fsUnlinkMock,
}));

// Stub requirements constants to stable values for test isolation
vi.mock("@caatinga/core/runtime/requirements", () => ({
  NODE_MIN_MAJOR: 22,
  RUST_MIN_VERSION: "1.84.0",
  CURRENT_RUST_WASM_TARGET: "wasm32v1-none",
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createSetupProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSetupCommand(program);
  return program;
}

function resetMocks(): void {
  runCommandMock.mockReset();
  execaMock.mockReset();
  checkStellarCliVersionMock.mockReset();
  httpsGetMock.mockReset();
}

type MockHttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  on: (evt: string, handler: (chunk?: Buffer) => void) => MockHttpResponse;
};

type MockHttpRequest = { on: (evt: string, handler: () => void) => void };

function mockHttpsGetWithScript(script: string): void {
  httpsGetMock.mockImplementation(
    (_url: unknown, cb: (res: MockHttpResponse) => void): MockHttpRequest => {
      const data = Buffer.from(script);
      const fakeRes: MockHttpResponse = {
        statusCode: 200,
        headers: {},
        on: (evt: string, handler: (chunk?: Buffer) => void) => {
          if (evt === "data") Promise.resolve().then(() => handler(data));
          else if (evt === "end") Promise.resolve().then(() => handler());
          return fakeRes;
        },
      };
      cb(fakeRes);
      return { on: () => {} };
    }
  );
}

// ─── checkNodeStep ────────────────────────────────────────────────────────────

describe("checkNodeStep", () => {
  it("should_return_ok_when_node_version_meets_minimum", () => {
    const result = checkNodeStep();
    expect(result.ok).toBe(true);
    expect(result.label).toContain(process.versions.node);
  });
});

// ─── installRustStep ─────────────────────────────────────────────────────────

describe("installRustStep", () => {
  beforeEach(resetMocks);

  it("should_skip_install_when_rust_already_meets_minimum", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "rustc 1.87.0 (abc123 2024-01-01)",
      stderr: "",
      all: "",
    });

    const result = await installRustStep();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.label).toContain("1.87.0");
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("should_update_rust_when_version_is_below_minimum", async () => {
    runCommandMock
      .mockResolvedValueOnce({ stdout: "rustc 1.80.0 (abc 2024-01-01)", stderr: "", all: "" })
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0 (abc 2024-01-01)", stderr: "", all: "" });

    execaMock.mockResolvedValueOnce({});

    const result = await installRustStep();

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.label).toContain("updated");
    expect(execaMock).toHaveBeenCalledWith("rustup", ["update", "stable"], {
      stdio: "inherit",
      env: {},
      cancelSignal: expect.any(AbortSignal),
    });
  });

  it("should_report_error_when_rustup_update_fails", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "rustc 1.80.0 (abc 2024-01-01)",
      stderr: "",
      all: "",
    });
    execaMock.mockRejectedValueOnce(new Error("rustup not found"));

    const result = await installRustStep();

    expect(result.ok).toBe(false);
    expect(result.label).toContain("could not be updated via rustup");
  });

  it("should_install_rust_when_not_found", async () => {
    runCommandMock
      .mockRejectedValueOnce(new Error("rustc not found"))
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0 (abc 2024-01-01)", stderr: "", all: "" });

    // Provide a test script and set its expected hash via env var
    const testScript = "#!/bin/sh\necho installing rustup";
    const crypto = await import("node:crypto");
    const testHash = crypto.createHash("sha256").update(testScript).digest("hex");
    process.env.CAATINGA_RUSTUP_INIT_SHA256 = testHash;

    mockHttpsGetWithScript(testScript);

    // Mock writeFile/unlink to prevent actual file system writes
    fsWriteFileMock.mockResolvedValue(undefined);
    fsUnlinkMock.mockResolvedValue(undefined);

    const result = await installRustStep();

    delete process.env.CAATINGA_RUSTUP_INIT_SHA256;
    vi.restoreAllMocks();

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.label).toContain("installed");
  });

  it("should_reject_rustup_when_checksum_mismatch", async () => {
    runCommandMock.mockRejectedValueOnce(new Error("rustc not found"));

    const testScript = "#!/bin/sh\necho wrong script";
    mockHttpsGetWithScript(testScript);

    const result = await installRustStep();

    expect(result.ok).toBe(false);
    expect(result.label).toContain("checksum mismatch");
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("should_return_error_when_rustc_not_on_path_after_install", async () => {
    runCommandMock
      .mockRejectedValueOnce(new Error("rustc not found"))
      .mockRejectedValueOnce(new Error("rustc still not found"));

    const testScript = "#!/bin/sh\necho installing rustup";
    const crypto = await import("node:crypto");
    const testHash = crypto.createHash("sha256").update(testScript).digest("hex");
    process.env.CAATINGA_RUSTUP_INIT_SHA256 = testHash;

    mockHttpsGetWithScript(testScript);

    execaMock.mockResolvedValueOnce({});

    fsWriteFileMock.mockResolvedValue(undefined);
    fsUnlinkMock.mockResolvedValue(undefined);

    const result = await installRustStep();

    delete process.env.CAATINGA_RUSTUP_INIT_SHA256;
    vi.restoreAllMocks();

    expect(result.ok).toBe(false);
    expect(result.label).toContain("not on PATH");
  });
});

// ─── installWasmTargetStep ───────────────────────────────────────────────────

describe("installWasmTargetStep", () => {
  beforeEach(resetMocks);

  it("should_skip_when_wasm_target_already_installed", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "wasm32v1-none\nwasm32-unknown-unknown",
      stderr: "",
      all: "",
    });

    const result = await installWasmTargetStep();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("should_install_wasm_target_when_missing", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "x86_64-unknown-linux-gnu",
      stderr: "",
      all: "",
    });
    execaMock.mockResolvedValueOnce({});

    const result = await installWasmTargetStep();

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(execaMock).toHaveBeenCalledWith("rustup", ["target", "add", "wasm32v1-none"], {
      stdio: "inherit",
      env: {},
      cancelSignal: expect.any(AbortSignal),
    });
  });

  it("should_return_error_when_rustup_fails", async () => {
    runCommandMock.mockRejectedValueOnce(new Error("rustup not found"));

    const result = await installWasmTargetStep();

    expect(result.ok).toBe(false);
    expect(result.label).toContain("Failed to install");
  });
});

// ─── installStellarCliStep ───────────────────────────────────────────────────

describe("installStellarCliStep", () => {
  beforeEach(resetMocks);

  it("should_skip_install_when_stellar_cli_meets_minimum", async () => {
    checkStellarCliVersionMock.mockResolvedValueOnce({ version: "25.2.0" });

    const result = await installStellarCliStep();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.label).toContain("25.2.0");
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("should_install_pinned_version_when_not_found", async () => {
    checkStellarCliVersionMock
      .mockRejectedValueOnce(new Error("stellar not found"))
      .mockResolvedValueOnce({ version: "25.2.0" });

    execaMock.mockResolvedValueOnce({});

    const result = await installStellarCliStep();

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(execaMock).toHaveBeenCalledWith(
      "cargo",
      ["install", "--locked", "stellar-cli", "--version", "25.2.0"],
      { stdio: "inherit", env: {}, cancelSignal: expect.any(AbortSignal) }
    );
  });

  it("should_install_pinned_version_when_existing_cli_is_below_minimum", async () => {
    const { CaatingaError, CaatingaErrorCode } = await import("@caatinga/core");
    checkStellarCliVersionMock
      .mockRejectedValueOnce(
        new CaatingaError(
          "Stellar CLI 22.0.0 is below the supported minimum 23.0.0.",
          CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
          "Install Stellar CLI 23.0.0 or newer."
        )
      )
      .mockResolvedValueOnce({ version: "25.2.0" });

    execaMock.mockResolvedValueOnce({});

    const result = await installStellarCliStep();

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(execaMock).toHaveBeenCalledWith(
      "cargo",
      ["install", "--locked", "stellar-cli", "--version", "25.2.0"],
      { stdio: "inherit", env: {}, cancelSignal: expect.any(AbortSignal) }
    );
  });

  it("should_return_error_with_build_dep_hint_when_cargo_install_fails", async () => {
    checkStellarCliVersionMock.mockRejectedValueOnce(new Error("stellar not found"));
    execaMock.mockRejectedValueOnce(new Error("cargo failed"));

    const result = await installStellarCliStep();

    expect(result.ok).toBe(false);
    expect(result.label).toContain("installation failed");
    expect(result.label).toContain("cargo binstall stellar-cli");
  });
});

// ─── createIdentityStep ──────────────────────────────────────────────────────

describe("createIdentityStep", () => {
  beforeEach(resetMocks);

  it("should_skip_when_identity_already_exists", async () => {
    runCommandMock.mockResolvedValueOnce({ stdout: "GABC123...", stderr: "", all: "" });

    const result = await createIdentityStep("alice", "testnet");

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("should_create_and_fund_identity_on_fundable_network", async () => {
    runCommandMock.mockRejectedValueOnce(new Error("identity not found"));
    execaMock.mockResolvedValueOnce({});

    const result = await createIdentityStep("alice", "testnet");

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.label).toContain("funded");
    expect(execaMock).toHaveBeenCalledWith(
      "stellar",
      ["keys", "generate", "alice", "--fund", "--network", "testnet"],
      { stdio: "inherit", env: {}, cancelSignal: expect.any(AbortSignal) }
    );
  });

  it("should_create_without_fund_on_non_fundable_network", async () => {
    runCommandMock.mockRejectedValueOnce(new Error("identity not found"));
    execaMock.mockResolvedValueOnce({});

    const result = await createIdentityStep("alice", "mainnet");

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.label).toContain("not funded");
    expect(execaMock).toHaveBeenCalledWith(
      "stellar",
      ["keys", "generate", "alice", "--network", "mainnet"],
      { stdio: "inherit", env: {}, cancelSignal: expect.any(AbortSignal) }
    );
  });

  it("should_return_error_when_identity_creation_fails", async () => {
    runCommandMock.mockRejectedValueOnce(new Error("identity not found"));
    execaMock.mockRejectedValueOnce(new Error("stellar fund failed"));

    const result = await createIdentityStep("alice", "testnet");

    expect(result.ok).toBe(false);
    expect(result.label).toContain("Failed to create identity");
  });
});

// ─── runSetup (integration) ───────────────────────────────────────────────────

describe("runSetup", () => {
  beforeEach(() => {
    resetMocks();
    process.exitCode = undefined;
  });

  it("should_complete_successfully_when_all_tools_already_installed", async () => {
    runCommandMock
      // rustc --version
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0 (abc 2024-01-01)", stderr: "", all: "" })
      // rustup target list
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" })
      // stellar keys public-key alice
      .mockResolvedValueOnce({ stdout: "GABC...", stderr: "", all: "" });
    // stellar CLI version check
    checkStellarCliVersionMock.mockResolvedValueOnce({ version: "25.2.0" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runSetup({ source: "alice", network: "testnet" });
      expect(process.exitCode).toBeUndefined();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Setup complete — all prerequisites satisfied");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should_report_skipped_steps_without_claiming_all_satisfied", async () => {
    runCommandMock
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0", stderr: "", all: "" })
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runSetup({
        source: "alice",
        network: "testnet",
        skipStellar: true,
        skipIdentity: true,
      });
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("steps skipped");
      expect(output).not.toContain("all prerequisites satisfied");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should_print_path_note_when_a_tool_was_installed", async () => {
    runCommandMock
      // rustc not found, then found after install
      .mockRejectedValueOnce(new Error("rustc not found"))
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0", stderr: "", all: "" })
      // rustup target list (target already present)
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" })
      // identity already exists
      .mockResolvedValueOnce({ stdout: "GABC...", stderr: "", all: "" });
    checkStellarCliVersionMock.mockResolvedValueOnce({ version: "25.2.0" });

    // Mock https.get for rustup download
    const testScript = "#!/bin/sh\necho installing rustup";
    const crypto = await import("node:crypto");
    const testHash = crypto.createHash("sha256").update(testScript).digest("hex");
    process.env.CAATINGA_RUSTUP_INIT_SHA256 = testHash;

    mockHttpsGetWithScript(testScript);

    execaMock.mockResolvedValueOnce({}); // rustup install execa call

    fsWriteFileMock.mockResolvedValue(undefined);
    fsUnlinkMock.mockResolvedValue(undefined);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runSetup({ source: "alice", network: "testnet" });
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("source");
      expect(output).toContain(".cargo/env");
    } finally {
      logSpy.mockRestore();
      delete process.env.CAATINGA_RUSTUP_INIT_SHA256;
      vi.restoreAllMocks();
    }
  });

  it("should_set_exit_code_1_when_stellar_cli_install_fails", async () => {
    runCommandMock
      // rustc ok
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0 (abc)", stderr: "", all: "" })
      // wasm ok
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" })
      // identity ok
      .mockResolvedValueOnce({ stdout: "GABC...", stderr: "", all: "" });
    // stellar not found, cargo install fails
    checkStellarCliVersionMock.mockRejectedValueOnce(new Error("not found"));
    execaMock.mockRejectedValueOnce(new Error("cargo failed"));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runSetup({ source: "alice", network: "testnet" });
      expect(process.exitCode).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should_call_onProgress_callback_for_each_step", async () => {
    runCommandMock
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0", stderr: "", all: "" })
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" });
    checkStellarCliVersionMock.mockResolvedValueOnce({ version: "25.2.0" });

    const events: { step: number; title: string; status: string }[] = [];
    const onProgress = (event: { step: number; total: number; title: string; status: string }) => {
      events.push({ step: event.step, title: event.title, status: event.status });
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runSetup(
        { source: "alice", network: "testnet", skipStellar: true, skipIdentity: true },
        onProgress
      );
      expect(events[0]).toMatchObject({ step: 1, title: "Node.js", status: "start" });
      expect(events[1]).toMatchObject({ step: 1, title: "Node.js", status: "complete" });
      const stepNumbers = events.map((e) => e.step);
      expect(stepNumbers).not.toContain(4);
      expect(stepNumbers).not.toContain(5);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── registerSetupCommand (CLI parsing) ──────────────────────────────────────

describe("registerSetupCommand", () => {
  beforeEach(() => {
    resetMocks();
    process.exitCode = undefined;
  });

  it("should_use_default_source_alice_and_network_testnet", async () => {
    runCommandMock
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0", stderr: "", all: "" })
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" })
      .mockResolvedValueOnce({ stdout: "GABC...", stderr: "", all: "" });
    checkStellarCliVersionMock.mockResolvedValueOnce({ version: "25.2.0" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await createSetupProgram().parseAsync(["node", "caatinga", "setup"]);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("alice");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should_respect_skip_identity_flag", async () => {
    runCommandMock
      .mockResolvedValueOnce({ stdout: "rustc 1.87.0", stderr: "", all: "" })
      .mockResolvedValueOnce({ stdout: "wasm32v1-none", stderr: "", all: "" });
    checkStellarCliVersionMock.mockResolvedValueOnce({ version: "25.2.0" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await createSetupProgram().parseAsync(["node", "caatinga", "setup", "--skip-identity"]);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("skipped");
    } finally {
      logSpy.mockRestore();
    }
  });
});
