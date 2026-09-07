import { pinyinMatches } from "./pinyin";
import type {
  Dataset,
  HanziIndex,
  Level,
  PhoneticAnchor,
  Radical,
  Topic,
  WordIndex,
} from "./types";

/** One phonetic series narrowed to a level selection. */
export interface PhoneticSeriesRow {
  meta: PhoneticAnchor;
  members: HanziIndex[];
}

/**
 * Visible phonetic series that have at least one member in the selected levels.
 * Membership is the hanzi indexes' effective `phonetic`; metadata comes from
 * the compact phonetics file. Sorted by member count, then component.
 */
export function phoneticsAtLevels(
  phonetics: Record<string, PhoneticAnchor>,
  hanzi: HanziIndex[],
  levels: Level[],
): PhoneticSeriesRow[] {
  const byComponent = new Map<string, HanziIndex[]>();
  for (const h of hanzi) {
    if (!levels.includes(h.level) || !h.phonetic) continue;
    const cur = byComponent.get(h.phonetic);
    if (cur) cur.push(h);
    else byComponent.set(h.phonetic, [h]);
  }
  const rows: PhoneticSeriesRow[] = [];
  for (const [component, members] of byComponent) {
    const meta = phonetics[component];
    if (!meta) continue;
    rows.push({
      meta,
      members: [...members].sort(
        (a, b) =>
          (a.frequency ?? Infinity) - (b.frequency ?? Infinity) || a.char.localeCompare(b.char),
      ),
    });
  }
  rows.sort(
    (a, b) =>
      b.members.length - a.members.length || a.meta.component.localeCompare(b.meta.component),
  );
  return rows;
}

/** Radicals appearing in the selected levels, with membership narrowed to them. */
export function radicalsAtLevels(
  radicals: Radical[],
  hanzi: HanziIndex[],
  levels: Level[],
): Radical[] {
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
 * The search predicates for the topic, radical and phonetic tabs.
 *
 * Shared with the tab bar so a badge can never disagree with the list it
 * labels. These tabs do not list entries, so they skip the pinyin and gloss
 * matching that `filters.ts` does for hanzi and words — except phonetics,
 * which match a series' own reading.
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

export const matchesPhonetic = (
  q: string,
  series: { meta: Pick<PhoneticAnchor, "component" | "anchor" | "pinyin" | "meaning"> },
): boolean => {
  if (!q) return true;
  const { component, anchor, pinyin, meaning } = series.meta;
  if (component.includes(q) || anchor.includes(q)) return true;
  if (pinyin.some((p) => pinyinMatches(q, p))) return true;
  return Boolean(meaning?.toLowerCase().includes(q.toLowerCase()));
};

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
