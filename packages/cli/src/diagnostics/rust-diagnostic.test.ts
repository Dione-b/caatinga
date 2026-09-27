import { beforeEach, describe, expect, it, vi } from "vitest";
import { RUST_MIN_VERSION } from "@caatinga/core/runtime/requirements";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(),
  isCargoBinMissingFromPath: vi.fn(),
}));

vi.mock("@caatinga/core", () => ({
  runCommand: mocks.runCommand,
  isCargoBinMissingFromPath: mocks.isCargoBinMissingFromPath,
}));

import { parseRustcVersion, rustDiagnostic } from "./rust-diagnostic.js";

describe("parseRustcVersion", () => {
  it("extracts the version from rustc --version output", () => {
    expect(parseRustcVersion("rustc 1.91.0 (f8297e351 2025-10-28)")).toBe("1.91.0");
  });

  it("returns undefined when no version token is present", () => {
    expect(parseRustcVersion("rustc: command produced no version")).toBeUndefined();
  });
});

describe("rustDiagnostic", () => {
  beforeEach(() => {
    mocks.runCommand.mockReset();
    mocks.isCargoBinMissingFromPath.mockReset();
    mocks.isCargoBinMissingFromPath.mockReturnValue(false);
  });

  it("reports ok when rustc meets RUST_MIN_VERSION", async () => {
    mocks.runCommand.mockResolvedValue({
      stdout: `rustc ${RUST_MIN_VERSION} (f8297e351 2025-10-28)`,
    });

    const diagnostic = await rustDiagnostic();

    expect(diagnostic.ok).toBe(true);
  });

  it("flags a toolchain older than RUST_MIN_VERSION with an actionable fix", async () => {
    mocks.runCommand.mockResolvedValue({ stdout: "rustc 1.80.0 (051478957 2024-01-01)" });

    const diagnostic = await rustDiagnostic();

    expect(diagnostic.ok).toBe(false);
    expect(diagnostic.label).toContain(RUST_MIN_VERSION);
    expect(diagnostic.fix).toContain("rustup update");
  });

  it("flags Rust 1.91.0, which stellar contract build rejects", async () => {
    mocks.runCommand.mockResolvedValue({ stdout: "rustc 1.91.0 (f8297e351 2025-10-28)" });

    const diagnostic = await rustDiagnostic();

    expect(diagnostic.ok).toBe(false);
    expect(diagnostic.label).toContain("rejected by stellar contract build");
    expect(diagnostic.fix).toContain(RUST_MIN_VERSION);
  });

  it.each(["1.81.0", "1.82.1", "1.83.0"])(
    "flags blocked release line %s as rejected rather than merely old",
    async (version) => {
      mocks.runCommand.mockResolvedValue({ stdout: `rustc ${version} (abc 2024-01-01)` });

      const diagnostic = await rustDiagnostic();

      expect(diagnostic.ok).toBe(false);
      expect(diagnostic.label).toContain("rejected by stellar contract build");
    }
  );

  it("reports ok for a release after the blocked 1.91.0", async () => {
    mocks.runCommand.mockResolvedValue({ stdout: "rustc 1.92.0 (abc 2025-12-01)" });

    const diagnostic = await rustDiagnostic();

    expect(diagnostic.ok).toBe(true);
  });

  it("stays ok when the version cannot be parsed", async () => {
    mocks.runCommand.mockResolvedValue({ stdout: "rustc (version unknown)" });

    const diagnostic = await rustDiagnostic();

    expect(diagnostic.ok).toBe(true);
  });
});
