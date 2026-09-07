import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANDS,
  DEFAULT_BANDS_PATH,
  bandsSummary,
  defaultBrowsePath,
  formatBands,
  formatLevels,
  isDefaultBands,
  levelLabel,
  parseBands,
  parseLevels,
  toggleExtra,
  toggleLevel,
  toggleLevelInBands,
} from "~/lib/levels";

describe("level selection", () => {
  it("parses single and multiple levels from the path", () => {
    expect(parseLevels("1")).toEqual([1]);
    expect(parseLevels("2")).toEqual([2]);
    expect(parseLevels("1,2")).toEqual([1, 2]);
    expect(parseLevels("1,2,3,4,5,6,7")).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("rejects anything that is not a real level", () => {
    for (const bad of ["", undefined, "0", "8", "1,8", "x", "1,", "1,1", "2,1", " 1", "extra", "1,extra"]) {
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

  it("defaults to every HSK band plus Extra", () => {
    expect(DEFAULT_BANDS_PATH).toBe("1,2,3,4,5,6,7,extra");
    expect(formatBands(DEFAULT_BANDS)).toBe(DEFAULT_BANDS_PATH);
    expect(isDefaultBands(DEFAULT_BANDS)).toBe(true);
    expect(defaultBrowsePath()).toBe("/hsk/1,2,3,4,5,6,7,extra/hanzi");
    expect(defaultBrowsePath("words")).toBe("/hsk/1,2,3,4,5,6,7,extra/words");
    expect(bandsSummary(DEFAULT_BANDS)).toBe("All levels + Extra");
    expect(bandsSummary({ levels: [1, 3], extra: true })).toBe("HSK 1, 3 + Extra");
    expect(bandsSummary({ levels: [], extra: true })).toBe("Extra");
    expect(bandsSummary({ levels: [1, 2, 3, 4, 5, 6, 7], extra: false })).toBe("All levels");
  });
});

describe("band selection", () => {
  it("parses Extra last, alone or after levels", () => {
    expect(parseBands("extra")).toEqual({ levels: [], extra: true });
    expect(parseBands("1,extra")).toEqual({ levels: [1], extra: true });
    expect(parseBands("1,2,extra")).toEqual({ levels: [1, 2], extra: true });
    expect(parseBands("1,2")).toEqual({ levels: [1, 2], extra: false });
  });

  it("rejects Extra anywhere but last, and sloppy lists", () => {
    for (const bad of ["extra,1", "1,extra,2", "extra,extra", "1,extra,", ",extra", "Extra"]) {
      expect(() => parseBands(bad)).toThrow();
    }
  });

  it("round-trips through formatBands", () => {
    for (const raw of ["1", "1,2", "extra", "1,extra", "1,2,extra", "1,2,3,4,5,6,7,extra"]) {
      expect(formatBands(parseBands(raw))).toBe(raw);
    }
  });

  it("toggles Extra without emptying the selection", () => {
    expect(toggleExtra({ levels: [1], extra: false })).toEqual({ levels: [1], extra: true });
    expect(toggleExtra({ levels: [1], extra: true })).toEqual({ levels: [1], extra: false });
    expect(toggleExtra({ levels: [], extra: true })).toEqual({ levels: [], extra: true });
  });

  it("lets the last HSK level turn off when Extra is on", () => {
    expect(toggleLevelInBands({ levels: [1], extra: true }, 1)).toEqual({
      levels: [],
      extra: true,
    });
    expect(toggleLevelInBands({ levels: [1], extra: false }, 1)).toEqual({
      levels: [1],
      extra: false,
    });
    expect(toggleLevelInBands({ levels: [], extra: true }, 2)).toEqual({
      levels: [2],
      extra: true,
    });
  });
});
