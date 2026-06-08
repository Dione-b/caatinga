import { describe, expect, it } from "vitest";
import { NODE_MIN_MAJOR } from "@caatinga/core/runtime/requirements";
import { nodeDiagnostic } from "./node-diagnostic.js";

describe("nodeDiagnostic", () => {
  it("should_report_ok_when_node_meets_minimum", () => {
    const diagnostic = nodeDiagnostic();

    expect(diagnostic.ok).toBe(true);
    expect(diagnostic.label).toContain(process.versions.node);
  });

  it("should_use_NODE_MIN_MAJOR_from_requirements", () => {
    expect(NODE_MIN_MAJOR).toBe(20);
  });
});
