/**
 * Search ranking.
 *
 * One box takes hanzi, pinyin and English, so a query is genuinely ambiguous:
 * "wait" is an English word, the head of wàitào 外套 and the middle of
 * "waitress". These tests pin the order those three land in, and that a card
 * shows the gloss the reader actually matched rather than the entry's first.
 *
 * Run against the real corpus, so they also fail if a gloss the ranking leans
 * on moves upstream.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import type { Hanzi, Word } from "~/lib/types";
import {
  TIER,
  filterHanzi,
  filterWords,
  glossFor,
  matchQuery,
  rankOf,
  readFilters,
  searchHanzi,
  searchWords,
} from "~/lib/filters";
import { pinyinRank } from "~/lib/pinyin";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const HSK1 = H.filter((h) => h.level === 1);

const filtersFor = (qs: string) => readFilters(new URLSearchParams(qs));

/** Rank a search result set the way the list routes do. */
const ranked = <T>(rs: { match: Parameters<typeof rankOf>[0] }[] & T[]) =>
  [...rs].sort((a, b) => rankOf(a.match) - rankOf(b.match));

const charAt = (list: Hanzi[], char: string) => list.find((h) => h.char === char)!;

describe("scoring a query", () => {
  it("ranks an exact gloss over a prefix over a whole word over a substring", () => {
    const score = (meaning: string) => matchQuery("wait", "x", [], [meaning])!.tier;
    expect(score("wait")).toBe(TIER.meaningExact);
    expect(score("wait for it")).toBe(TIER.meaningPrefix);
    expect(score("to wait for")).toBe(TIER.meaningWord);
    expect(score("waitress")).toBe(TIER.meaningSubstring);
    expect(matchQuery("wait", "x", [], ["to hurry"])).toBeNull();
  });

  it("scores every occurrence, not just the first", () => {
    // "wait" first appears buried inside "awaiting"; the real hit is later.
    const m = matchQuery("wait", "x", [], ["awaiting; to wait"])!;
    expect(m.tier).toBe(TIER.meaningWord);
    expect("awaiting; to wait".slice(m.at![0], m.at![1])).toBe("wait");
  });

  it("keeps a half-syllable pinyin collision below the English hits", () => {
    // "wait" is a prefix of wài tào, but it is an English word first.
    expect(pinyinRank("wait", "wài tào")).toBe("partial");
    expect(TIER.meaningWord).toBeLessThan(TIER.pinyinPartial);
    const top = ranked(searchWords(W, filtersFor("q=wait"))).slice(0, 5);
    expect(top.map((r) => r.w.word)).not.toContain("外套");
  });

  it("keeps a syllable-boundary pinyin hit above accidental English substrings", () => {
    expect(pinyinRank("hao", "hǎo")).toBe("exact");
    expect(pinyinRank("ai", "ài hào")).toBe("syllable");
    expect(TIER.pinyinPartial).toBeLessThan(TIER.meaningSubstring);
  });

  it("still matches pinyin with and without tones", () => {
    const chars = (q: string) => searchHanzi(H, filtersFor(`q=${q}`)).map((r) => r.h.char);
    expect(chars("hao")).toContain("好");
    expect(chars("hao")).toContain("号");
    expect(chars("hao3")).toContain("好");
    expect(chars("hao3")).not.toContain("号");
  });

  it("ranks a character above the characters merely built from it", () => {
    const rs = ranked(searchHanzi(HSK1, filtersFor("q=%E5%A5%B3"))); // 女
    expect(rs[0]!.h.char).toBe("女");
    expect(rs[0]!.match!.field).toBe("hanzi");
    const hao = rs.find((r) => r.h.char === "好")!;
    expect(hao.match!.field).toBe("component");
    expect(rankOf(rs[0]!.match)).toBeLessThan(rankOf(hao.match));
  });

  it("does not treat a query that normalizes to nothing as a match-all", () => {
    // toneless("?") is "", and every string starts with "".
    expect(filterHanzi(H, filtersFor("q=%3F")).length).toBeLessThan(H.length);
  });
});

describe("the gloss shown on the card", () => {
  it("shows the meaning that matched, not the entry's first", () => {
    // 等 glosses as "class, rank, grade, … to wait for": the hit is buried at
    // index 5, and the card used to read "class" for a search of "wait".
    const deng = searchHanzi(HSK1, filtersFor("q=wait")).find((r) => r.h.char === "等")!;
    expect(deng.match!.field).toBe("meaning");
    expect(deng.match!.index).toBeGreaterThan(0);
    expect(charAt(HSK1, "等").meanings[0]).toBe("class");
    expect(glossFor(deng.h.meanings, deng.match).text).toBe("to wait for");
  });

  it("clips a semicolon-joined dictionary gloss to the clause that matched", () => {
    // 候's only gloss is one blob; the whole string truncates to noise.
    const hou = searchHanzi(HSK1, filtersFor("q=wait")).find((r) => r.h.char === "候")!;
    expect(hou.h.meanings[0]).toContain(";");
    const { text, at } = glossFor(hou.h.meanings, hou.match);
    expect(text).toBe("to wait, to expect");
    expect(text.slice(at![0], at![1])).toBe("wait");
  });

  it("puts the matched gloss first and keeps the rest for context", () => {
    const m = ["class", "rank", "to wait for"];
    const match = matchQuery("wait", "x", [], m)!;
    expect(glossFor(m, match, 2).text).toBe("to wait for; class");
  });

  it("falls back to the primary gloss when the hit was not on a meaning", () => {
    const m = ["class", "rank"];
    expect(glossFor(m, null, 2)).toEqual({ text: "class; rank", at: null });
    expect(glossFor(m, matchQuery("deng", "等", ["děng"], m), 2).at).toBeNull();
  });

  it("locates the hit however the reader capitalised it", () => {
    const m = matchQuery("WAIT", "x", [], ["to Wait for"])!;
    expect("to Wait for".slice(m.at![0], m.at![1])).toBe("Wait");
  });
});

describe("ordering", () => {
  it("bumps a stronger match above a weaker one", () => {
    // 等 glosses exactly as "grade"; 第's mention of it is buried in prose.
    const rs = ranked(searchHanzi(HSK1, filtersFor("q=grade")));
    expect(rs[0]!.h.char).toBe("等");
    expect(rs[0]!.match!.tier).toBe(TIER.meaningExact);
    for (let i = 1; i < rs.length; i += 1) {
      expect(rankOf(rs[i - 1]!.match)).toBeLessThanOrEqual(rankOf(rs[i]!.match));
    }
  });

  it("leaves an unqueried list exactly where it was", () => {
    const rs = searchHanzi(H, filtersFor(""));
    expect(rs.every((r) => r.match === null)).toBe(true);
    expect(rs.map((r) => r.h)).toEqual(H);
    // Relevance is a no-op with no query: rankOf must stay finite, or the
    // comparator's subtraction becomes NaN and the browse order scrambles.
    expect(Number.isFinite(rankOf(null))).toBe(true);
    expect(rankOf(null) - rankOf(null)).toBe(0);
  });
});

describe("filter and search agree", () => {
  it("filterHanzi is searchHanzi without the metadata", () => {
    for (const q of ["", "wait", "hao", "%E5%A5%B3"]) {
      const f = filtersFor(`q=${q}`);
      expect(filterHanzi(H, f)).toEqual(searchHanzi(H, f).map((r) => r.h));
    }
  });

  it("filterWords is searchWords without the metadata", () => {
    for (const q of ["", "wait", "hao", "%E5%A5%BD"]) {
      const f = filtersFor(`q=${q}`);
      expect(filterWords(W, f)).toEqual(searchWords(W, f).map((r) => r.w));
    }
  });

  it("still honours the non-query filters alongside a query", () => {
    const f = filtersFor("q=wait&s=stub");
    for (const { h } of searchHanzi(HSK1, f)) expect(h.authored?.status ?? "stub").toBe("stub");
  });
});
