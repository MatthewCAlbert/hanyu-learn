/**
 * Doubled-form detection for browse search.
 *
 * AABB / ABAB / AA are closed string patterns. These tests pin the base the
 * detector extracts, and that browse only surfaces a corpus entry already in
 * the selected bands — 马马虎虎 finds 马虎 at HSK 7, not on HSK 1.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import type { Hanzi, Word } from "~/lib/types";
import { TIER, matchQuery, readFilters, searchHanzi, searchWords } from "~/lib/filters";
import { aabbPinyin, aaPinyin, hanziRedup, pinyinRedup } from "~/lib/reduplication";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const H1 = H.filter((h) => h.level === 1);
const W1 = W.filter((w) => w.level === 1 && !w.extra);
const W7 = W.filter((w) => w.level === 7 && !w.extra);

const filtersFor = (qs: string) => readFilters(new URLSearchParams(qs));

describe("hanzi patterns", () => {
  it("maps AABB, ABAB and AA onto the undoubled base", () => {
    expect(hanziRedup("马马虎虎")).toEqual({ base: "马虎", kind: "aabb" });
    expect(hanziRedup("高高兴兴")).toEqual({ base: "高兴", kind: "aabb" });
    expect(hanziRedup("研究研究")).toEqual({ base: "研究", kind: "abab" });
    expect(hanziRedup("看看")).toEqual({ base: "看", kind: "aa" });
    expect(hanziRedup("妈妈")).toEqual({ base: "妈", kind: "aa" });
  });

  it("rejects AABB of the same character twice, odd lengths, and unrelated strings", () => {
    expect(hanziRedup("哈哈哈哈")).toBeNull();
    expect(hanziRedup("马虎")).toBeNull();
    expect(hanziRedup("好")).toBeNull();
    expect(hanziRedup("马马虎")).toBeNull();
  });
});

describe("pinyin patterns", () => {
  it("doubles two-syllable and one-syllable readings without tones", () => {
    expect(aabbPinyin("mǎ hu")).toBe("mamahuhu");
    expect(aabbPinyin("gāo xìng")).toBe("gaogaoxingxing");
    expect(aaPinyin("kàn")).toBe("kankan");
    expect(aabbPinyin("mā ma")).toBeNull();
    expect(aabbPinyin("hǎo")).toBeNull();
  });

  it("recognizes a doubled query against the entry reading", () => {
    expect(pinyinRedup("mamahuhu", "mǎ hu")).toBe("aabb");
    expect(pinyinRedup("kankan", "kàn")).toBe("aa");
    expect(pinyinRedup("gege", "gè")).toBe("aa");
    expect(pinyinRedup("hao", "hǎo")).toBeNull();
  });
});

describe("matchQuery", () => {
  it("ranks a doubled query below an exact hit of the same string", () => {
    expect(TIER.hanziExact).toBeLessThan(TIER.hanziRedup);
    expect(TIER.pinyinExact).toBeLessThan(TIER.pinyinRedup);
    expect(TIER.hanziRedup).toBeLessThan(TIER.pinyinExact);

    const aabb = matchQuery("马马虎虎", "马虎", ["mǎ hu"], ["careless"])!;
    expect(aabb.tier).toBe(TIER.hanziRedup);
    expect(aabb.redup).toBe("aabb");

    const pinyin = matchQuery("mamahuhu", "马虎", ["mǎ hu"], ["careless"])!;
    expect(pinyin.tier).toBe(TIER.pinyinRedup);
    expect(pinyin.redup).toBe("aabb");

    const aa = matchQuery("看看", "看", ["kàn"], ["to see"])!;
    expect(aa.tier).toBe(TIER.hanziRedup);
    expect(aa.redup).toBe("aa");

    const mama = matchQuery("妈妈", "妈妈", ["mā ma"], ["mum"])!;
    expect(mama.tier).toBe(TIER.hanziExact);
    expect(mama.redup).toBeUndefined();

    const hao = matchQuery("好", "好", ["hǎo"], ["good"])!;
    expect(hao.tier).toBe(TIER.hanziExact);
    expect(hao.redup).toBeUndefined();
    const haoPy = matchQuery("hao", "好", ["hǎo"], ["good"])!;
    expect(haoPy.tier).toBe(TIER.pinyinExact);
    expect(haoPy.redup).toBeUndefined();
  });
});

describe("browse search", () => {
  it("finds 马虎 on HSK 7 Words for 马马虎虎 and mamahuhu, not on HSK 1", () => {
    const hanziHits = searchWords(W7, filtersFor("q=马马虎虎"));
    expect(hanziHits.map((r) => r.w.word)).toEqual(["马虎"]);
    expect(hanziHits[0]!.match!.redup).toBe("aabb");

    const pinyinHits = searchWords(W7, filtersFor("q=mamahuhu"));
    expect(pinyinHits.map((r) => r.w.word)).toEqual(["马虎"]);
    expect(pinyinHits[0]!.match!.redup).toBe("aabb");

    expect(searchWords(W1, filtersFor("q=马马虎虎"))).toEqual([]);
    expect(searchWords(W1, filtersFor("q=mamahuhu"))).toEqual([]);
  });

  it("finds 看 for 看看 on HSK 1 Hanzi, and leaves 好 / hao as exact hits", () => {
    const kan = searchHanzi(H1, filtersFor("q=看看")).find((r) => r.h.char === "看")!;
    expect(kan.match!.redup).toBe("aa");
    expect(searchHanzi(H1, filtersFor("q=kankan")).find((r) => r.h.char === "看")!.match!.redup).toBe(
      "aa",
    );

    const hao = searchHanzi(H1, filtersFor("q=好")).find((r) => r.h.char === "好")!;
    expect(hao.match!.tier).toBe(TIER.hanziExact);
    expect(hao.match!.redup).toBeUndefined();

    const haoPy = searchHanzi(H1, filtersFor("q=hao")).find((r) => r.h.char === "好")!;
    expect(haoPy.match!.tier).toBe(TIER.pinyinExact);
    expect(haoPy.match!.redup).toBeUndefined();
  });

  it("keeps 妈妈 as an exact word hit, not a doubled form of 妈", () => {
    const hits = searchWords(W1, filtersFor("q=妈妈"));
    expect(hits.map((r) => r.w.word)).toContain("妈妈");
    const mama = hits.find((r) => r.w.word === "妈妈")!;
    expect(mama.match!.tier).toBe(TIER.hanziExact);
    expect(mama.match!.redup).toBeUndefined();
    expect(hits.some((r) => r.w.word === "妈")).toBe(false);
  });
});
