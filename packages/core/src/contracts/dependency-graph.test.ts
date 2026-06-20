import { describe, expect, it } from "vitest";
import { buildDependencyGraph } from "./dependency-graph.js";

describe("buildDependencyGraph", () => {
  it("should_map_each_contract_name_to_its_dependsOn_list", () => {
    const contracts = {
      token: { path: "./t", wasm: "./t.wasm", dependsOn: [], deployArgs: {} },
      marketplace: {
        path: "./m",
        wasm: "./m.wasm",
        dependsOn: ["token"],
        deployArgs: {},
      },
    };
    expect(buildDependencyGraph(contracts)).toEqual({
      token: [],
      marketplace: ["token"],
    });
  });
});
