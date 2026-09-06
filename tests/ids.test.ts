import { describe, expect, it } from "vitest";
import { idsLeaves, idsToString, isAtomic, parseIds } from "~/lib/ids";

describe("parseIds", () => {
  it("parses a simple left-right compound", () => {
    const tree = parseIds("⿰女子");
    expect(tree).toEqual({
      kind: "compound",
      idc: "⿰",
      children: [
        { kind: "leaf", char: "女" },
        { kind: "leaf", char: "子" },
      ],
    });
  });

  it("parses nested compounds", () => {
    const tree = parseIds("⿱⿱爫冖友")!;
    expect(idsLeaves(tree)).toEqual(["爫", "冖", "友"]);
  });

  it("handles ternary IDCs", () => {
    expect(idsLeaves(parseIds("⿲彳丨亍")!)).toEqual(["彳", "丨", "亍"]);
  });

  it("round-trips", () => {
    for (const ids of ["⿰女子", "⿱⿱爫冖友", "⿲彳丨亍", "⿴口大", "？"]) {
      expect(idsToString(parseIds(ids)!)).toBe(ids);
    }
  });

  it("represents unknown decompositions", () => {
    expect(parseIds("？")).toEqual({ kind: "unknown" });
    expect(isAtomic("？")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(parseIds("⿰女")).toBeNull(); // too few operands
    expect(parseIds("⿰女子子")).toBeNull(); // trailing input
  });
});
