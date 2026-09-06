import { describe, expect, it } from "vitest";
import { numeric, pinyinMatches, splitTone, toneless } from "~/lib/pinyin";

describe("pinyin normalization", () => {
  it("splits tone marks", () => {
    expect(splitTone("hǎo")).toEqual({ base: "hao", tone: 3 });
    expect(splitTone("hao3")).toEqual({ base: "hao", tone: 3 });
    expect(splitTone("de")).toEqual({ base: "de", tone: 0 });
  });

  it("maps the three forms onto one key", () => {
    expect(numeric("hǎo")).toBe("hao3");
    expect(numeric("hao3")).toBe("hao3");
    expect(toneless("hǎo")).toBe("hao");
    expect(toneless("ài hào")).toBe("aihao");
  });

  it("folds ü to v", () => {
    expect(toneless("nǚ")).toBe("nv");
  });

  it("matches tone-insensitively unless the query has tones", () => {
    expect(pinyinMatches("hao", "hǎo")).toBe(true);
    expect(pinyinMatches("hao", "hào")).toBe(true);
    expect(pinyinMatches("hao3", "hǎo")).toBe(true);
    expect(pinyinMatches("hao3", "hào")).toBe(false);
  });

  it("matches multi-syllable words by prefix", () => {
    expect(pinyinMatches("aihao", "ài hào")).toBe(true);
    expect(pinyinMatches("ai", "ài hào")).toBe(true);
  });
});
