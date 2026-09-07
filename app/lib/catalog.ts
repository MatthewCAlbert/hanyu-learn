import type { Dataset, HanziIndex, Level, Radical, Topic, WordIndex } from "./types";

/** Radicals appearing in the selected levels, with membership narrowed to them. */
export function radicalsAtLevels(radicals: Radical[], hanzi: HanziIndex[], levels: Level[]): Radical[] {
  const chars = new Set(hanzi.filter((h) => levels.includes(h.level)).map((h) => h.char));
  return radicals
    .map((r) => ({ ...r, hanzi: r.hanzi.filter((c) => chars.has(c)) }))
    .filter((r) => r.hanzi.length > 0);
}

/**
 * Topics with membership narrowed to a level selection, plus how many entries
 * in that selection carry no topic at all — the untagged backlog.
 */
export function topicsAtLevels(
  topics: Topic[],
  hanzi: HanziIndex[],
  words: WordIndex[],
  levels: Level[],
) {
  const chars = new Set(hanzi.filter((h) => levels.includes(h.level)).map((h) => h.char));
  const wordSet = new Set(words.filter((w) => levels.includes(w.level)).map((w) => w.word));
  const narrowed = topics.map((t) => ({
    ...t,
    hanzi: t.hanzi.filter((c) => chars.has(c)),
    words: t.words.filter((w) => wordSet.has(w)),
  }));
  const untagged =
    hanzi.filter((h) => levels.includes(h.level) && h.topics.length === 0).length +
    words.filter((w) => levels.includes(w.level) && w.topics.length === 0).length;
  return { topics: narrowed, untagged, total: chars.size + wordSet.size };
}

/**
 * The search predicates for the topic and radical tabs.
 *
 * Shared with the tab bar so a badge can never disagree with the list it
 * labels. Neither tab lists entries, so neither goes through the pinyin and
 * gloss matching that `filters.ts` does for hanzi and words.
 */
export const matchesTopic = (q: string, t: Pick<Topic, "id" | "label">): boolean =>
  !q || t.label.toLowerCase().includes(q.toLowerCase()) || t.id.includes(q.toLowerCase());

export const matchesRadical = (
  q: string,
  r: Pick<Radical, "char" | "variants" | "gloss">,
): boolean =>
  !q ||
  r.char.includes(q) ||
  r.variants.some((v) => v.includes(q)) ||
  r.gloss.toLowerCase().includes(q.toLowerCase());

/** Per-level counts summed over a selection. */
export function countsFor(counts: Dataset["counts"], levels: Level[]) {
  return levels.reduce(
    (acc, l) => ({
      entries: acc.entries + counts[l].entries,
      hanzi: acc.hanzi + counts[l].hanzi,
      words: acc.words + counts[l].words,
      radicals: 0,
    }),
    { entries: 0, hanzi: 0, words: 0, radicals: 0 },
  );
}
