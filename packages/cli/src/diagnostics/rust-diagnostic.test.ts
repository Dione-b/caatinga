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

  it("stays ok when the version cannot be parsed", async () => {
    mocks.runCommand.mockResolvedValue({ stdout: "rustc (version unknown)" });

    const diagnostic = await rustDiagnostic();

    expect(diagnostic.ok).toBe(true);
  });
});
