/**
 * Topic membership is authored in topic-centric files and inverted onto entries
 * at build time. These tests guard that inversion and the many-to-many
 * behaviour that distinguishes topics from radicals.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import topicsJson from "~/data/generated/topics.json";
import type { Hanzi, Topic, Word } from "~/lib/types";
import { UNTAGGED, filterHanzi, readFilters } from "~/lib/filters";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const T = topicsJson as unknown as Topic[];

const filtersFor = (qs: string) => readFilters(new URLSearchParams(qs));

describe("topic vocabulary", () => {
  it("has unique kebab-case ids and a label each", () => {
    const ids = new Set<string>();
    for (const t of T) {
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ids.has(t.id), `duplicate ${t.id}`).toBe(false);
      ids.add(t.id);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it("only references entries that exist in the corpus", () => {
    const chars = new Set(H.map((h) => h.char));
    const wordSet = new Set(W.map((w) => w.word));
    for (const t of T) {
      for (const c of t.hanzi) expect(chars.has(c), `${t.id}: ${c}`).toBe(true);
      for (const w of t.words) expect(wordSet.has(w), `${t.id}: ${w}`).toBe(true);
    }
  });
});

describe("inversion round-trip", () => {
  it("entry.topics agrees with the topic files in both directions", () => {
    // file -> entry
    for (const t of T) {
      for (const c of t.hanzi) {
        expect(H.find((h) => h.char === c)?.topics).toContain(t.id);
      }
      for (const w of t.words) {
        expect(W.find((x) => x.word === w)?.topics).toContain(t.id);
      }
    }
    // entry -> file
    const byId = new Map(T.map((t) => [t.id, t]));
    for (const h of H) {
      for (const id of h.topics) expect(byId.get(id)?.hanzi).toContain(h.char);
    }
    for (const w of W) {
      for (const id of w.topics) expect(byId.get(id)?.words).toContain(w.word);
    }
  });

  it("supports an entry belonging to several topics at once", () => {
    const multi = [...H, ...W].filter((e) => e.topics.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    const plane = W.find((w) => w.word === "飞机");
    expect(plane?.topics).toEqual(expect.arrayContaining(["travel", "technology"]));
  });

  it("leaves function words untagged, which is a valid answer", () => {
    expect(H.find((h) => h.char === "的")?.topics).toEqual([]);
  });
});

describe("pair expansion for topic grouping", () => {
  /** Mirrors the loader: one placement per topic, or one for untagged. */
  const placements = (entries: { topics: string[] }[]) =>
    entries.reduce((n, e) => n + Math.max(e.topics.length, 1), 0);

  it("counts an entry once per topic, and untagged entries once", () => {
    const tagged = H.filter((h) => h.topics.length > 0);
    const untagged = H.filter((h) => h.topics.length === 0);
    expect(placements(H)).toBe(
      tagged.reduce((n, h) => n + h.topics.length, 0) + untagged.length,
    );
    // Strictly more placements than entries, because some entries repeat.
    expect(placements(H)).toBeGreaterThan(H.length - untagged.length + tagged.length - 1);
  });
});

describe("topic filtering", () => {
  it("untagged and the real topics partition the corpus", () => {
    const all = H.length;
    const untagged = filterHanzi(H, filtersFor(`topic=${UNTAGGED}`)).length;
    const tagged = filterHanzi(
      H,
      filtersFor(T.map((t) => `topic=${t.id}`).join("&")),
    ).length;
    expect(untagged + tagged).toBe(all);
  });

  it("selects entries carrying any of the chosen topics", () => {
    const travel = filterHanzi(H, filtersFor("topic=travel"));
    expect(travel.every((h) => h.topics.includes("travel"))).toBe(true);
    expect(travel.map((h) => h.char)).toContain("车");
  });

  it("no filter means no narrowing", () => {
    expect(filterHanzi(H, filtersFor("")).length).toBe(H.length);
  });
});
