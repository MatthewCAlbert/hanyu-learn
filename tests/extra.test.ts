/**
 * Supplement vocabulary sits beside HSK, not inside it. These alarms keep the
 * Extra band from leaking into pinned HSK counts or the official wordlist.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import extraSource from "../data/sources/extra-vocabulary.json";
import lexemesJson from "~/data/generated/lexemes.json";
import type { Hanzi, Lexeme, Word } from "~/lib/types";
import { isHanziLexeme, lexemeHref } from "~/lib/lexical";
import { readFilters, searchLexemes } from "~/lib/filters";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const SOURCE = extraSource as { word: string }[];
const L = lexemesJson as unknown as Lexeme[];

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

describe("extra spoken/chat lexemes", () => {
  it("keeps 啥 off the Extra country list and off HSK words", () => {
    const extra = new Set(W.filter((w) => w.extra).map((w) => w.word));
    const hsk = new Set(W.filter((w) => !w.extra).map((w) => w.word));
    const chars = new Set(H.map((h) => h.char));
    expect(extra.has("啥")).toBe(false);
    expect(hsk.has("啥")).toBe(false);
    expect(L.some((l) => l.form === "啥")).toBe(true);
    expect(lexemeHref("啥")).toBe("/lexemes/%E5%95%A5");
    for (const l of L) {
      expect(hsk.has(l.form), l.form).toBe(false);
      expect(extra.has(l.form), l.form).toBe(false);
      if (isHanziLexeme(l.form)) expect(chars.has(l.form), l.form).toBe(false);
    }
  });

  it("finds 啥 by hanzi and by pinyin when Extra filters are empty", () => {
    const none = readFilters(new URLSearchParams());
    expect(searchLexemes(L, none).some((x) => x.lexeme.form === "啥")).toBe(true);
    const sha = searchLexemes(L, readFilters(new URLSearchParams("q=啥")));
    expect(sha.map((x) => x.lexeme.form)).toContain("啥");
    const pinyin = searchLexemes(L, readFilters(new URLSearchParams("q=sha")));
    expect(pinyin.map((x) => x.lexeme.form)).toContain("啥");
    const radical = searchLexemes(L, readFilters(new URLSearchParams("r=人")));
    expect(radical).toEqual([]);
  });

  it("puts 啥 on Extra Hanzi and 搞定 on Extra Words Spoken, not in extra-vocabulary", () => {
    const hanziLex = L.filter((l) => isHanziLexeme(l.form)).map((l) => l.form);
    expect(hanziLex).toEqual(expect.arrayContaining(["啥", "咋", "呗"]));
    expect(hanziLex.every((form) => [...form].length === 1)).toBe(true);
    expect(L.map((l) => l.form)).toEqual(expect.arrayContaining(["搞定", "哥们", "咋了", "干啥"]));
    expect(SOURCE.some((e) => e.word === "搞定")).toBe(false);
    expect(SOURCE.some((e) => e.word === "啥")).toBe(false);
  });
});
