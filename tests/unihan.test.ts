import { describe, expect, it } from "vitest";
import radicalIndex from "../data/sources/radical-index.json";
import { kRSUnicodeCitationError, parseUnihanKRSUnicode } from "~/lib/unihan";

const index = radicalIndex.kRSUnicode as Record<string, { radical: number; extra: number }>;

describe("parseUnihanKRSUnicode", () => {
  it("reads radical and residual strokes", () => {
    expect(parseUnihanKRSUnicode("Unihan kRSUnicode: 113.4 (radical 示)")).toEqual({
      radical: 113,
      extra: 4,
    });
  });

  it("accepts the simplified-form apostrophe Unihan uses", () => {
    expect(parseUnihanKRSUnicode("Unihan kRSUnicode: 169'.3 (radical 門)")).toEqual({
      radical: 169,
      extra: 3,
    });
  });

  it("returns null when the source is not a kRSUnicode citation", () => {
    expect(parseUnihanKRSUnicode("說文解字, 見部: 視, 瞻也。从見、示")).toBeNull();
  });
});

describe("kRSUnicodeCitationError", () => {
  it("rejects a citation that disagrees with the vendored index", () => {
    expect(kRSUnicodeCitationError("Unihan kRSUnicode: 147.4 (radical 見)", "视", index)).toBe(
      "Unihan kRSUnicode cited 147.4 but the index has 113.4",
    );
  });

  it("accepts a citation that matches the index, including an optional apostrophe", () => {
    expect(kRSUnicodeCitationError("Unihan kRSUnicode: 113.4 (radical 示)", "视", index)).toBeNull();
    expect(kRSUnicodeCitationError("Unihan kRSUnicode: 169'.3 (radical 門)", "问", index)).toBeNull();
  });
});
