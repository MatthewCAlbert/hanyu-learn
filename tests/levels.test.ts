import { describe, expect, it } from "vitest";
import { formatLevels, levelLabel, parseLevels, toggleLevel } from "~/lib/levels";

describe("level selection", () => {
  it("parses single and multiple levels from the path", () => {
    expect(parseLevels("1")).toEqual([1]);
    expect(parseLevels("2")).toEqual([2]);
    expect(parseLevels("1,2")).toEqual([1, 2]);
    expect(parseLevels("1,2,3,4,5,6,7")).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("rejects anything that is not a real level", () => {
    for (const bad of ["", undefined, "0", "8", "1,8", "x", "1,", "1,1", "2,1", " 1"]) {
      expect(() => parseLevels(bad)).toThrow();
    }
  });

  it("round-trips through formatLevels", () => {
    for (const raw of ["1", "2", "1,2", "3,5,7", "1,2,3,4,5,6,7"]) {
      expect(formatLevels(parseLevels(raw))).toBe(raw);
    }
  });

  it("toggles a level on and off", () => {
    expect(toggleLevel([1], 2)).toEqual([1, 2]);
    expect(toggleLevel([1, 2], 1)).toEqual([2]);
    expect(toggleLevel([2], 1)).toEqual([1, 2]);
  });

  it("never lets the selection become empty", () => {
    expect(toggleLevel([1], 1)).toEqual([1]);
    expect(toggleLevel([2], 2)).toEqual([2]);
  });

  it("labels the 7-9 band, which the wordlist merges", () => {
    expect(levelLabel(1)).toBe("1");
    expect(levelLabel(7)).toBe("7–9");
  });
});
