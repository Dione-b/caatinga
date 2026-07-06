import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectDeploymentMetadata } from "./metadata.js";
import { runCommand } from "../shell/run-command.js";
import { CAATINGA_CORE_VERSION } from "../version.js";

vi.mock("../shell/run-command.js", () => ({
  runCommand: vi.fn(),
}));

describe("collectDeploymentMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should collect all metadata successfully", async () => {
    vi.mocked(runCommand).mockImplementation(async (command: string) => {
      if (command === "git") {
        return { stdout: "git_commit_hash\n", stderr: "", all: "git_commit_hash\n" };
      }
      if (command === "rustc") {
        return { stdout: "rustc 1.84.0\n", stderr: "", all: "rustc 1.84.0\n" };
      }
      throw new Error("unexpected command");
    });

    const metadata = await collectDeploymentMetadata({
      networkName: "testnet",
      wasmHash: "wasm_hash_123",
      cwd: "/workspace",
    });

    expect(metadata.gitCommit).toBe("git_commit_hash");
    expect(metadata.rustcVersion).toBe("rustc 1.84.0");
    expect(metadata.caatingaVersion).toBe(CAATINGA_CORE_VERSION);
    expect(metadata.network).toBe("testnet");
    expect(metadata.checksum).toBe("wasm_hash_123");
    expect(metadata.timestamp).toBeDefined();
  });

  it("should handle git or rustc failures gracefully", async () => {
    vi.mocked(runCommand).mockRejectedValue(new Error("binary not found"));

    const metadata = await collectDeploymentMetadata({
      networkName: "local",
      wasmHash: "wasm_hash_abc",
      cwd: "/workspace",
    });

    expect(metadata.gitCommit).toBeUndefined();
    expect(metadata.rustcVersion).toBeUndefined();
    expect(metadata.caatingaVersion).toBe(CAATINGA_CORE_VERSION);
    expect(metadata.network).toBe("local");
    expect(metadata.checksum).toBe("wasm_hash_abc");
    expect(metadata.timestamp).toBeDefined();
  });
});
