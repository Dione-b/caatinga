import { describe, expect, it, vi } from "vitest";
import { createZkInstallProgress } from "./zk-install-progress.js";

describe("createZkInstallProgress", () => {
  it("should_forward_status_messages_to_logger", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const progress = createZkInstallProgress();

    progress.onStatus?.("Installing snarkjs...");

    expect(info).toHaveBeenCalledWith("Installing snarkjs...");
    info.mockRestore();
  });

  it("should_render_download_progress_to_stderr", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const progress = createZkInstallProgress();

    progress.onDownloadProgress?.(50, 100);
    progress.onDownloadProgress?.(100, 100);

    expect(write).toHaveBeenCalled();
    write.mockRestore();
  });

  it("should_flush_download_line_on_complete", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const progress = createZkInstallProgress();

    progress.onDownloadProgress?.(1024);
    progress.onDownloadComplete?.();

    expect(write).toHaveBeenCalledWith("\n");
    write.mockRestore();
  });
});
