/**
 * Supplement vocabulary sits beside HSK, not inside it. These alarms keep the
 * Extra band from leaking into pinned HSK counts or the official wordlist.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import extraSource from "../data/sources/extra-vocabulary.json";
import type { Hanzi, Word } from "~/lib/types";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const SOURCE = extraSource as { word: string }[];

describe("extra vocabulary", () => {
  const extra = W.filter((w) => w.extra);
  const hsk = new Set(W.filter((w) => !w.extra).map((w) => w.word));
  const chars = new Set(H.map((h) => h.char));

  it("is pinned, disjoint from HSK, and uses only HSK characters", () => {
    expect(extra).toHaveLength(229);
    expect(SOURCE).toHaveLength(229);
    expect(extra.map((w) => w.word).sort()).toEqual([...SOURCE.map((e) => e.word)].sort());
    for (const w of extra) {
      expect(hsk.has(w.word), w.word).toBe(false);
      expect(w.chars.every((c) => chars.has(c)), w.word).toBe(true);
      expect(w.standards).toEqual([]);
    }
  });

  it("includes 法国 and 日本, and omits names the hanzi set cannot spell", () => {
    const set = new Set(extra.map((w) => w.word));
    expect(set.has("法国")).toBe(true);
    expect(set.has("日本")).toBe(true);
    expect(set.has("美国")).toBe(true);
    expect(set.has("乌克兰")).toBe(true);
    expect(set.has("印尼语")).toBe(true);
    expect(set.has("韩国")).toBe(false);
    expect(set.has("澳大利亚")).toBe(false);
    expect(set.has("韩语")).toBe(false);
    expect(set.has("埃及")).toBe(false);
    expect(set.has("匈牙利")).toBe(false);
    expect(hsk.has("法语")).toBe(true);
    expect(hsk.has("日语")).toBe(true);
  });

  it("has reviewed explanations for every Extra word", () => {
    for (const w of extra) {
      expect(w.authored?.status, w.word).toBe("reviewed");
    }
  });
});
