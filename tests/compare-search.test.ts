import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import radicals from "~/data/generated/radicals.json";
import topicsJson from "~/data/generated/topics.json";
import type {
  Hanzi,
  HanziIndex,
  PhoneticAnchor,
  Radical,
  Topic,
  Word,
  WordIndex,
} from "~/lib/types";
import { flattenCompareHits, searchCompare } from "~/lib/compare-search";
import type { CompareCatalog } from "~/lib/detail-data";
import { effectivePhonetic, effectiveSemantic } from "~/lib/etymology";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const R = radicals as unknown as Radical[];
const T = topicsJson as unknown as Topic[];

function asHanziIndex(h: Hanzi): HanziIndex {
  return {
    char: h.char,
    level: h.level,
    pinyin: h.pinyin,
    meanings: h.meanings,
    frequency: h.frequency,
    radical: h.radical,
    radicalCanonical: h.radicalCanonical,
    components: h.components,
    standards: h.standards,
    topics: h.topics,
    status: h.authored?.status ?? "stub",
    phonetic: effectivePhonetic(h),
    semantic: effectiveSemantic(h),
  };
}

function asWordIndex(w: Word): WordIndex {
  return {
    word: w.word,
    level: w.level,
    pinyin: w.pinyin,
    meanings: w.meanings,
    frequency: w.frequency,
    standards: w.standards,
    topics: w.topics,
    status: w.authored?.status ?? "stub",
    literal: w.authored?.literal ?? null,
    transparency: w.authored?.transparency ?? null,
  };
}

const PHONETICS: PhoneticAnchor[] = [
  {
    component: "马",
    anchor: "马",
    pinyin: ["mǎ"],
    meaning: "horse",
    radical: null,
    hanzi: "马",
  },
  {
    component: "礻",
    anchor: "示",
    pinyin: ["shì"],
    meaning: "altar",
    radical: null,
    hanzi: "示",
  },
];

const catalog: CompareCatalog = {
  hanzi: H.map(asHanziIndex),
  words: W.map(asWordIndex),
  radicals: R,
  topics: T,
  phonetics: PHONETICS,
};

const hitsOf = (q: string, kind: string) =>
  searchCompare(catalog, q)
    .find((g) => g.kind === kind)
    ?.hits.map((h) => h.ref.id) ?? [];

describe("searchCompare", () => {
  it("returns nothing until the reader types", () => {
    expect(searchCompare(catalog, "")).toEqual([]);
    expect(searchCompare(catalog, "  ")).toEqual([]);
  });

  it("ranks an exact hanzi above words that merely contain it", () => {
    const groups = searchCompare(catalog, "好");
    expect(groups[0]?.kind).toBe("hanzi");
    expect(groups[0]?.hits[0]?.ref).toEqual({ kind: "hanzi", id: "好" });
    expect(hitsOf("好", "word").length).toBeGreaterThan(0);
    expect(hitsOf("好", "word").every((w) => w.includes("好"))).toBe(true);
  });

  it("finds a multi-character word by its characters and by English", () => {
    expect(hitsOf("爱好", "word")[0]).toBe("爱好");
    expect(hitsOf("hobby", "word")).toContain("爱好");
  });

  it("finds a radical by form, gloss, and Kangxi number", () => {
    expect(hitsOf("女", "radical")).toContain("女");
    const woman = searchCompare(catalog, "woman").find((g) => g.kind === "radical")?.hits ?? [];
    expect(woman.some((h) => h.ref.id === "女")).toBe(true);
    expect(hitsOf("#38", "radical")).toContain("女");
  });

  it("finds a phonetic series by component and by reading", () => {
    expect(hitsOf("马", "phonetic")).toContain("马");
    expect(hitsOf("ma", "phonetic")).toContain("马");
    expect(hitsOf("礻", "phonetic")).toContain("礻");
  });

  it("finds a topic by label and by id", () => {
    expect(hitsOf("travel", "topic")).toContain("travel");
    expect(hitsOf("food", "topic")).toContain("food-and-drink");
  });

  it("groups mixed-kind results and caps each group", () => {
    const groups = searchCompare(catalog, "好");
    expect(groups.map((g) => g.kind)).toEqual(expect.arrayContaining(["hanzi", "word"]));
    const hanzi = groups.find((g) => g.kind === "hanzi")!;
    expect(hanzi.hits.length).toBeGreaterThan(0);
    expect(hanzi.hits.length).toBeLessThanOrEqual(8);
    expect(flattenCompareHits(groups).every((h) => h.title.length > 0)).toBe(true);
  });
});
