import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildToolchainPrepend,
  isCargoBinMissingFromPath,
  resolveSubprocessEnv,
} from "./resolve-subprocess-env.js";

describe("resolveSubprocessEnv", () => {
  it("should_prepend_cargo_bin_when_it_exists", () => {
    const home = os.homedir();
    const cargoBin = path.join(home, ".cargo", "bin");
    const env = resolveSubprocessEnv({
      HOME: home,
      PATH: "/usr/bin",
    });

    expect(env.PATH?.startsWith(cargoBin)).toBe(true);
    expect(env.PATH).toContain("/usr/bin");
  });

  it("should_report_when_cargo_exists_but_cargo_bin_not_on_path", () => {
    const home = os.homedir();
    const missing = isCargoBinMissingFromPath({
      HOME: home,
      PATH: "/usr/bin",
    });

    expect(typeof missing).toBe("boolean");
  });
});

describe("buildToolchainPrepend", () => {
  it("should_prefer_stellar_from_original_path_over_cargo_bin_stellar", () => {
    const home = "/home/dev";
    const cargoBin = path.join(home, ".cargo", "bin");
    const localBin = path.join(home, ".local", "bin");
    const executableExists = (binDir: string, name: string) => {
      if (name !== "stellar") {
        return binDir === cargoBin;
      }

      return binDir === cargoBin || binDir === localBin;
    };

    const prepend = buildToolchainPrepend([localBin, "/usr/bin"], [cargoBin], executableExists);

    expect(prepend[0]).toBe(localBin);
    expect(prepend[1]).toBe(cargoBin);
  });
});
