import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core";

const accessMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    access: accessMock,
  };
});

import { resolveTemplateDir } from "./template-path.js";

describe("resolveTemplateDir", () => {
  const previousTemplatesDir = process.env.CAATINGA_TEMPLATES_DIR;
  const previousDebug = process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION;

  beforeEach(() => {
    delete process.env.CAATINGA_TEMPLATES_DIR;
    delete process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION;
    accessMock.mockRejectedValue(new Error("ENOENT"));
  });

  afterEach(() => {
    accessMock.mockReset();
    if (previousTemplatesDir === undefined) {
      delete process.env.CAATINGA_TEMPLATES_DIR;
    } else {
      process.env.CAATINGA_TEMPLATES_DIR = previousTemplatesDir;
    }
    if (previousDebug === undefined) {
      delete process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION;
    } else {
      process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION = previousDebug;
    }
  });

  it("throws TEMPLATE_NOT_FOUND when no template candidate is accessible", async () => {
    await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_NOT_FOUND,
    });
  });

  it("prints the candidates it tried when CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1", async () => {
    process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION = "1";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
        code: CaatingaErrorCode.TEMPLATE_NOT_FOUND,
      });

      const output = logSpy.mock.calls.map((call) => call[0]).join("");
      expect(output).toContain(
        'template resolution candidates for "__caatinga_nonexistent_template__"'
      );
      expect(output).toContain("env=");
      expect(output).toContain("cwd=");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("mentions the pnpm build prerequisite in the error hint", async () => {
    await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_NOT_FOUND,
      hint: expect.stringContaining("pnpm build"),
    });
  });
});
