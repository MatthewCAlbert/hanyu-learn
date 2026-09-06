/**
 * Invariants over the generated dataset. These are regression alarms: if an
 * upstream source shifts or the build logic drifts, the counts move and this
 * fails loudly rather than silently degrading the app.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import radicals from "~/data/generated/radicals.json";
import counts from "~/data/generated/counts.json";
import radicalIndex from "../data/sources/radical-index.json";
import type { Hanzi, Level, Radical, Word } from "~/lib/types";
import { parseIds, idsLeaves, isAtomic } from "~/lib/ids";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const R = radicals as unknown as Radical[];

const HANZI_RE = /[一-鿿]/u;
const hanziOf = (s: string) => [...s].filter((c) => HANZI_RE.test(c));

const byLevel = (l: Level) => H.filter((h) => h.level === l);
const known = (l: Level) => new Set(H.filter((h) => h.level <= l).map((h) => h.char));

describe("level partition", () => {
  it("matches the official HSK 3.0 shape", () => {
    // Pinned per level as a regression alarm on the upstream wordlist.
    expect(counts[1]).toEqual({ entries: 506, hanzi: 300, words: 294, radicals: 111 });
    expect(counts[2]).toEqual({ entries: 750, hanzi: 298, words: 574, radicals: 103 });
    expect(counts[3]).toEqual({ entries: 953, hanzi: 301, words: 799, radicals: 107 });
    expect(counts[4]).toEqual({ entries: 972, hanzi: 300, words: 818, radicals: 102 });
    expect(counts[5]).toEqual({ entries: 1059, hanzi: 300, words: 889, radicals: 105 });
    expect(counts[6]).toEqual({ entries: 1123, hanzi: 300, words: 939, radicals: 89 });
    expect(counts[7]).toEqual({ entries: 5606, hanzi: 1171, words: 5130, radicals: 152 });
  });

  it("introduces about 300 characters per level through level 6", () => {
    for (const l of [1, 2, 3, 4, 5, 6] as const) {
      expect(counts[l].hanzi).toBeGreaterThanOrEqual(298);
      expect(counts[l].hanzi).toBeLessThanOrEqual(302);
    }
  });

  it("assigns every hanzi to exactly one level", () => {
    const seen = new Map<string, Level>();
    for (const h of H) {
      expect(seen.has(h.char), `${h.char} appears twice`).toBe(false);
      seen.set(h.char, h.level);
    }
  });

  it("totals agree with the per-level counts", () => {
    const levels = Object.values(counts);
    expect(H).toHaveLength(levels.reduce((n, c) => n + c.hanzi, 0));
    expect(W).toHaveLength(levels.reduce((n, c) => n + c.words, 0));
    expect(H).toHaveLength(2970);
    expect(W).toHaveLength(9443);
  });
});

describe("referential integrity", () => {
  const chars = new Set(H.map((h) => h.char));

  it("every character of every word exists in the hanzi set", () => {
    const missing = W.flatMap((w) => w.chars.filter((c) => !chars.has(c)));
    expect(missing).toEqual([]);
  });

  it("a word never introduces a character above its own level", () => {
    const bad = W.filter((w) => w.chars.some((c) => !known(w.level).has(c)));
    expect(bad.map((w) => w.word)).toEqual([]);
  });

  it("every hanzi resolves to a radical present in the radical index", () => {
    const rad = new Set(R.map((r) => r.char));
    expect(H.filter((h) => !rad.has(h.radicalCanonical))).toEqual([]);
  });

  it("radical membership is consistent both ways", () => {
    for (const r of R) {
      for (const c of r.hanzi) {
        expect(H.find((h) => h.char === c)?.radicalCanonical).toBe(r.char);
      }
    }
    expect(R.reduce((n, r) => n + r.hanzi.length, 0)).toBe(H.length);
  });

  /**
   * Regression for a real bug: groups were keyed on the written variant, so
   * 买 (written with 大 but indexed by Unihan under #5 乙) renamed the whole
   * 大 group to "second". Grouping is by Kangxi number; variants are recorded.
   */
  it("groups by canonical Kangxi radical, recording written variants", () => {
    expect(new Set(R.map((r) => r.number)).size).toBe(R.length);
    for (const r of R) {
      expect(r.char).toBe(r.canonical);
      expect(r.display).toBeTruthy();
    }
    // Where makemeahanzi's written form is not a form of Unihan's indexed
    // radical at all (难 is written with 又 but indexed under 隹), we record no
    // variant and fall back to the canonical rather than assert a false one.
    for (const r of R) expect(r.display.length).toBeGreaterThan(0);
    const ren = R.find((r) => r.number === 9)!;
    expect(ren.char).toBe("人");
    expect(ren.variants).toContain("亻");
    expect(ren.display).toBe("亻"); // most members write it this way
    expect(R.find((r) => r.number === 37)?.gloss).toBe("big");
    // 买 is written with 大 but indexed under 乙; it must not pollute乙's variants.
    expect(R.find((r) => r.number === 5)?.variants).not.toContain("大");
  });

  it("only records variants Unihan confirms for that radical", () => {
    const index = radicalIndex.kRSUnicode as Record<string, { radical: number }>;
    const supplement = radicalIndex.variantToKangxi as Record<string, number>;
    for (const r of R) {
      for (const v of r.variants) {
        const ambiguous = radicalIndex.ambiguousVariants as Record<string, number[]>;
        const ok =
          v === r.canonical ||
          index[v]?.radical === r.number ||
          supplement[v] === r.number ||
          (ambiguous[v]?.includes(r.number) ?? false);
        expect(ok, `${v} listed under #${r.number} ${r.canonical}`).toBe(true);
      }
    }
  });

  it("every reverse word reference resolves", () => {
    const wordSet = new Set(W.map((w) => w.word));
    const dangling = H.flatMap((h) => h.words.filter((w) => !wordSet.has(w)));
    expect(dangling).toEqual([]);
  });
});

describe("decomposition", () => {
  it("every decomposition parses", () => {
    const bad = H.filter((h) => !isAtomic(h.decomposition) && parseIds(h.decomposition) === null);
    expect(bad.map((h) => `${h.char} ${h.decomposition}`)).toEqual([]);
  });

  it("components match the parsed leaves", () => {
    for (const h of H) {
      if (isAtomic(h.decomposition)) {
        expect(h.components).toEqual([]);
        continue;
      }
      const leaves = new Set(idsLeaves(parseIds(h.decomposition)!));
      for (const c of h.components) expect(leaves.has(c)).toBe(true);
    }
  });

  it("flags whether declared components are visible in the simplified form", () => {
    for (const h of H) {
      const e = h.etymology;
      if (!e || isAtomic(h.decomposition)) continue;
      const leaves = new Set(idsLeaves(parseIds(h.decomposition)!));
      if (e.semantic) expect(e.semanticVisible, `${h.char} semantic ${e.semantic}`).toBe(leaves.has(e.semantic));
      if (e.phonetic) expect(e.phoneticVisible, `${h.char} phonetic ${e.phonetic}`).toBe(leaves.has(e.phonetic));
    }
  });

  it("marks the characters whose phonetic was lost in simplification", () => {
    const lost = new Set(
      H.filter((h) => h.etymology?.phonetic && h.etymology.phoneticVisible === false).map(
        (h) => h.char,
      ),
    );
    // The HSK 1-2 cases, which the playbook documents by name.
    for (const c of ["举", "商", "场", "满", "爷", "蛋", "边", "过"]) {
      expect(lost.has(c), `${c} should be flagged`).toBe(true);
    }
    // A phonetic marked lost must genuinely be absent from the character.
    for (const h of H) {
      if (h.etymology?.phoneticVisible !== false || isAtomic(h.decomposition)) continue;
      const leaves = new Set(idsLeaves(parseIds(h.decomposition)!));
      expect(leaves.has(h.etymology.phonetic!)).toBe(false);
    }
  });
});

describe("example sentences", () => {
  /**
   * The whole premise of the feature: an example never contains a character
   * the learner has not met yet at that level.
   */
  it("only ever use characters known at that level", () => {
    for (const entry of [...H, ...W]) {
      const vocab = known(entry.level);
      for (const s of entry.sentences) {
        const unknown = hanziOf(s.cmn).filter((c) => !vocab.has(c));
        expect(unknown, `${"char" in entry ? entry.char : entry.word}: ${s.cmn}`).toEqual([]);
      }
    }
  });

  it("actually contain the entry they illustrate", () => {
    for (const entry of [...H, ...W]) {
      const needle = "char" in entry ? entry.char : entry.word;
      for (const s of entry.sentences) expect(s.cmn).toContain(needle);
    }
  });

  it("covers every level 1 character", () => {
    expect(byLevel(1).filter((h) => h.sentences.length === 0)).toEqual([]);
  });
});
