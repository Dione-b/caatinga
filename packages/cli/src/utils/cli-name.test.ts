import { afterEach, describe, expect, it } from "vitest";
import { npxCli, resolveCliProgramName } from "./cli-name.js";

describe("resolveCliProgramName", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("should_return_ctg_when_argv_basename_is_ctg", () => {
    expect(resolveCliProgramName("/usr/local/bin/ctg")).toBe("ctg");
    expect(resolveCliProgramName("ctg")).toBe("ctg");
  });

  it("should_return_caatinga_for_other_basenames", () => {
    expect(resolveCliProgramName("/usr/local/bin/caatinga")).toBe("caatinga");
    expect(resolveCliProgramName("caatinga.js")).toBe("caatinga");
    expect(resolveCliProgramName("index.js")).toBe("caatinga");
    expect(resolveCliProgramName(undefined)).toBe("caatinga");
  });

  it("should_format_npx_tips_with_invoked_binary", () => {
    process.argv = ["node", "/usr/local/bin/ctg"];
    expect(npxCli("build counter")).toBe("npx ctg build counter");

    process.argv = ["node", "/usr/local/bin/caatinga"];
    expect(npxCli("deploy counter --network testnet")).toBe(
      "npx caatinga deploy counter --network testnet"
    );
  });
});
