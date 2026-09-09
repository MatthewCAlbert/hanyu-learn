/**
 * Grammar lessons are authored as files, inverted onto hanzi/words at build
 * time, and listed in a level-scoped curriculum. These tests guard the graph
 * helpers and the generated backlinks.
 */
import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import grammarJson from "~/data/generated/grammar.json";
import type {
  DatasetManifest,
  GrammarIndex,
  GrammarLesson,
  GrammarPage,
  Hanzi,
  HanziPage,
  Word,
  WordPage,
} from "~/lib/types";
import {
  findGrammarCycle,
  grammarAtLevels,
  grammarHaystack,
  matchesGrammar,
  toGrammarIndex,
} from "~/lib/grammar";
import { LEVELS } from "~/lib/levels";
import { SHARD_BUCKETS, shardBucket } from "~/lib/shards";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const G = grammarJson as unknown as GrammarLesson[];
const HANZI_RE = /[一-鿿]/u;
const hanziOf = (s: string) => [...s].filter((c) => HANZI_RE.test(c));
const known = (level: number) => new Set(H.filter((h) => h.level <= level).map((h) => h.char));
const WEB = "app/data/generated/web";

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(`${WEB}/${rel}`, "utf8")) as T;
}

describe("findGrammarCycle", () => {
  it("returns null for a DAG", () => {
    expect(
      findGrammarCycle([
        { id: "a", prerequisites: [] },
        { id: "b", prerequisites: ["a"] },
        { id: "c", prerequisites: ["b"] },
      ]),
    ).toBeNull();
  });

  it("reports the cycle path", () => {
    expect(
      findGrammarCycle([
        { id: "a", prerequisites: ["c"] },
        { id: "b", prerequisites: ["a"] },
        { id: "c", prerequisites: ["b"] },
      ]),
    ).toEqual(["a", "c", "b", "a"]);
  });
});

describe("grammar search", () => {
  it("matches title, pattern, linked forms and example text", () => {
    const lesson: GrammarLesson = {
      id: "shi-copula",
      title: "Equative 是",
      pattern: "A 是 B",
      level: 1,
      order: 10,
      status: "drafted",
      confidence: "high",
      sources: [],
      prerequisites: [],
      hanzi: ["是"],
      words: ["老师"],
      examples: [{ cmn: "我是老师。", eng: "I am a teacher." }],
      patternNotes: "是 links two noun phrases.",
      usage: null,
      notes: null,
    };
    const row = toGrammarIndex(lesson);
    expect(matchesGrammar("是", row)).toBe(true);
    expect(matchesGrammar("teacher", row)).toBe(true);
    expect(matchesGrammar("equative", row)).toBe(true);
    expect(matchesGrammar("老师", row)).toBe(true);
    expect(matchesGrammar("吗", row)).toBe(false);
    expect(grammarHaystack(lesson)).toContain("a 是 b");
  });

  it("keeps curriculum order inside a level and does not merge bands", () => {
    const rows: GrammarIndex[] = [
      { id: "b", title: "B", pattern: "B", level: 2, order: 10, status: "drafted", hanzi: [], words: [], haystack: "b" },
      { id: "a2", title: "A2", pattern: "A2", level: 1, order: 20, status: "drafted", hanzi: [], words: [], haystack: "a2" },
      { id: "a1", title: "A1", pattern: "A1", level: 1, order: 10, status: "drafted", hanzi: [], words: [], haystack: "a1" },
    ];
    expect(grammarAtLevels(rows, [1]).map((g) => g.id)).toEqual(["a1", "a2"]);
    expect(grammarAtLevels(rows, [1, 2]).map((g) => g.id)).toEqual(["a1", "a2", "b"]);
  });

  it("retains more than 20 lessons per HSK band in curriculum order", () => {
    const perLevel = 21;
    const rows: GrammarIndex[] = LEVELS.flatMap((level) =>
      Array.from({ length: perLevel }, (_, i) => {
        const order = (perLevel - i) * 10;
        const id = `l${level}-o${order}`;
        return {
          id,
          title: id,
          pattern: id,
          level,
          order,
          status: "drafted" as const,
          hanzi: [],
          words: [],
          haystack: id,
        };
      }),
    );

    for (const level of LEVELS) {
      const ids = grammarAtLevels(rows, [level]).map((g) => g.id);
      expect(ids).toHaveLength(perLevel);
      expect(ids).toEqual(
        Array.from({ length: perLevel }, (_, i) => `l${level}-o${(i + 1) * 10}`),
      );
    }

    const all = grammarAtLevels(rows, LEVELS);
    expect(all).toHaveLength(LEVELS.length * perLevel);
    expect(all.map((g) => g.id)).toEqual(
      LEVELS.flatMap((level) =>
        Array.from({ length: perLevel }, (_, i) => `l${level}-o${(i + 1) * 10}`),
      ),
    );
  });
});

describe("authored grammar corpus", () => {
  it("has unique ids and unique order per level", () => {
    const ids = new Set<string>();
    const order = new Map<string, string>();
    for (const g of G) {
      expect(g.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ids.has(g.id), `duplicate ${g.id}`).toBe(false);
      ids.add(g.id);
      const key = `${g.level}:${g.order}`;
      expect(order.has(key), `order clash ${key}`).toBe(false);
      order.set(key, g.id);
    }
    expect(findGrammarCycle(G)).toBeNull();
  });

  it("only references corpus hanzi/words, and examples stay i+1", () => {
    const chars = new Set(H.map((h) => h.char));
    const wordSet = new Set(W.map((w) => w.word));
    for (const g of G) {
      for (const c of g.hanzi) expect(chars.has(c), `${g.id}: ${c}`).toBe(true);
      for (const w of g.words) expect(wordSet.has(w), `${g.id}: ${w}`).toBe(true);
      const vocab = known(g.level);
      for (const ex of g.examples) {
        const unknown = hanziOf(ex.cmn).filter((c) => !vocab.has(c));
        expect(unknown, `${g.id}: ${ex.cmn}`).toEqual([]);
      }
    }
  });

  it("inverts membership onto hanzi and words in both directions", () => {
    for (const g of G) {
      for (const c of g.hanzi) {
        expect(H.find((h) => h.char === c)?.grammarLessonIds).toContain(g.id);
      }
      for (const w of g.words) {
        expect(W.find((x) => x.word === w)?.grammarLessonIds).toContain(g.id);
      }
    }
    for (const h of H) {
      for (const id of h.grammarLessonIds) {
        expect(G.find((g) => g.id === id)?.hanzi).toContain(h.char);
      }
    }
    for (const w of W) {
      for (const id of w.grammarLessonIds) {
        expect(G.find((g) => g.id === id)?.words).toContain(w.word);
      }
    }
  });

  it("seeds HSK 1 with both hanzi and word backlinks and a prerequisite", () => {
    const shi = G.find((g) => g.id === "shi-copula");
    const ma = G.find((g) => g.id === "ma-yes-no");
    expect(shi?.hanzi).toContain("是");
    expect(shi?.words).toEqual(expect.arrayContaining(["老师", "学生"]));
    expect(H.find((h) => h.char === "是")?.grammarLessonIds).toContain("shi-copula");
    expect(W.find((w) => w.word === "老师")?.grammarLessonIds).toContain("shi-copula");
    expect(ma?.prerequisites).toContain("shi-copula");
  });
});

describe("grammar web shards", () => {
  it("indexes and detail buckets cover every lesson", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const names = await readdir(`${WEB}/${version}`);
    expect(names).toEqual(expect.arrayContaining(["g1.json", "gd"]));
    const indexed: GrammarIndex[] = [];
    for (const level of [1, 2, 3, 4, 5, 6, 7] as const) {
      const rows = await readJson<GrammarIndex[]>(`${version}/g${level}.json`);
      expect(rows.every((row) => row.level === level)).toBe(true);
      indexed.push(...rows);
    }
    expect(indexed.map((g) => g.id).sort()).toEqual(G.map((g) => g.id).sort());

    const buckets = await Promise.all(
      Array.from({ length: SHARD_BUCKETS }, (_, i) =>
        readJson<Record<string, GrammarPage>>(`${version}/gd/${i}.json`),
      ),
    );
    for (const g of G) {
      const page = buckets[shardBucket(g.id)]![g.id];
      expect(page?.lesson.id).toBe(g.id);
      expect(page?.hanzi.map((h) => h.char)).toEqual(g.hanzi);
      expect(page?.words.map((w) => w.word)).toEqual(g.words);
    }

    const gd = await readdir(`${WEB}/${version}/gd`);
    expect(gd).toHaveLength(SHARD_BUCKETS);
  });

  it("embeds lesson chips on linked hanzi and word detail pages", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const hanziBuckets = await Promise.all(
      Array.from({ length: SHARD_BUCKETS }, (_, i) =>
        readJson<Record<string, HanziPage>>(`${version}/hd/${i}.json`),
      ),
    );
    const wordBuckets = await Promise.all(
      Array.from({ length: SHARD_BUCKETS }, (_, i) =>
        readJson<Record<string, WordPage>>(`${version}/wd/${i}.json`),
      ),
    );
    const shi = hanziBuckets[shardBucket("是")]!["是"];
    expect(shi?.grammar.some((g) => g.id === "shi-copula")).toBe(true);
    const laoshi = wordBuckets[shardBucket("老师")]!["老师"];
    expect(laoshi?.grammar.some((g) => g.id === "shi-copula")).toBe(true);
  });
});
