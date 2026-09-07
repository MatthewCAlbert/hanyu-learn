import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import type { Hanzi, HanziIndex, PhoneticAnchor } from "~/lib/types";
import { effectivePhonetic, effectiveSemantic } from "~/lib/etymology";
import { matchesPhonetic, phoneticsAtLevels } from "~/lib/catalog";

const H = hanzi as unknown as Hanzi[];

function asIndex(h: Hanzi): HanziIndex {
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

const INDEX = H.map(asIndex);

function anchors(list: HanziIndex[]): Record<string, PhoneticAnchor> {
  const out: Record<string, PhoneticAnchor> = {};
  for (const h of list) {
    if (!h.phonetic || out[h.phonetic]) continue;
    out[h.phonetic] = {
      component: h.phonetic,
      anchor: h.phonetic,
      pinyin: [],
      meaning: null,
      radical: null,
      hanzi: null,
    };
  }
  out["礻"] = {
    component: "礻",
    anchor: "示",
    pinyin: ["shì"],
    meaning: "altar",
    radical: null,
    hanzi: "示",
  };
  out["马"] = {
    component: "马",
    anchor: "马",
    pinyin: ["mǎ"],
    meaning: "horse",
    radical: null,
    hanzi: "马",
  };
  return out;
}

const PHONETICS = anchors(INDEX);

describe("phoneticsAtLevels", () => {
  it("lists series present in the selected levels, not every corpus series", () => {
    const l1 = phoneticsAtLevels(PHONETICS, INDEX, [1]);
    const ma = l1.find((r) => r.meta.component === "马");
    expect(ma?.members.map((m) => m.char)).toEqual(expect.arrayContaining(["妈", "吗"]));
    expect(ma?.members.every((m) => m.level === 1)).toBe(true);
    expect(l1.find((r) => r.meta.component === "礻")?.members.map((m) => m.char)).toContain("视");
  });

  it("does not mix phonetic membership with radical membership", () => {
    const ma = phoneticsAtLevels(PHONETICS, INDEX, [1, 2, 3, 4, 5, 6, 7]).find(
      (r) => r.meta.component === "马",
    );
    expect(ma?.members.map((m) => m.char)).toEqual(expect.arrayContaining(["妈", "吗", "骂"]));
    expect(ma?.members.map((m) => m.char)).not.toContain("神");
  });

  it("never treats a lost phonetic as a series member", () => {
    for (const row of phoneticsAtLevels(PHONETICS, INDEX, [1, 2, 3, 4, 5, 6, 7])) {
      expect(row.members.map((m) => m.char)).not.toContain("场");
      expect(row.members.map((m) => m.char)).not.toContain("商");
    }
  });

  it("sorts by member count, then component", () => {
    const rows = phoneticsAtLevels(PHONETICS, INDEX, [1]);
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      expect(prev.members.length).toBeGreaterThanOrEqual(cur.members.length);
      if (prev.members.length === cur.members.length) {
        expect(prev.meta.component.localeCompare(cur.meta.component)).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe("matchesPhonetic", () => {
  const shi = { meta: PHONETICS["礻"]! };
  const ma = { meta: PHONETICS["马"]! };

  it("matches component, anchor, pinyin and gloss", () => {
    expect(matchesPhonetic("礻", shi)).toBe(true);
    expect(matchesPhonetic("示", shi)).toBe(true);
    expect(matchesPhonetic("shi", shi)).toBe(true);
    expect(matchesPhonetic("shì", shi)).toBe(true);
    expect(matchesPhonetic("altar", shi)).toBe(true);
  });

  it("does not match an unrelated series", () => {
    expect(matchesPhonetic("horse", shi)).toBe(false);
    expect(matchesPhonetic("马", shi)).toBe(false);
    expect(matchesPhonetic("shi", ma)).toBe(false);
  });

  it("passes through an empty query", () => {
    expect(matchesPhonetic("", shi)).toBe(true);
  });
});
