/**
 * Single access point for the generated dataset. Server-only so the full
 * corpus never ships to the browser — loaders send just what a route renders.
 */
import hanziJson from "~/data/generated/hanzi.json";
import wordsJson from "~/data/generated/words.json";
import radicalsJson from "~/data/generated/radicals.json";
import topicsJson from "~/data/generated/topics.json";
import countsJson from "~/data/generated/counts.json";
import type { Dataset, Hanzi, Level, Radical, Topic, Word } from "./types";
import { LEVELS } from "./levels";

export { LEVELS, parseLevels, formatLevels } from "./levels";

export const HANZI = hanziJson as unknown as Hanzi[];
export const WORDS = wordsJson as unknown as Word[];
export const RADICALS = radicalsJson as unknown as Radical[];
export const COUNTS = countsJson as unknown as Dataset["counts"];
export const TOPICS = topicsJson as unknown as Topic[];

const hanziByChar = new Map(HANZI.map((h) => [h.char, h]));
const wordByText = new Map(WORDS.map((w) => [w.word, w]));
const radicalByChar = new Map(RADICALS.map((r) => [r.char, r]));
const topicById = new Map(TOPICS.map((t) => [t.id, t]));

export const getHanzi = (char: string) => hanziByChar.get(char);
export const getWord = (word: string) => wordByText.get(word);
export const getRadical = (char: string) => radicalByChar.get(char);
export const getTopic = (id: string) => topicById.get(id);

/** Radicals appearing in the selected levels, with membership narrowed to them. */
export function radicalsAtLevels(levels: Level[]): Radical[] {
  const chars = new Set(HANZI.filter((h) => levels.includes(h.level)).map((h) => h.char));
  return RADICALS.map((r) => ({ ...r, hanzi: r.hanzi.filter((c) => chars.has(c)) })).filter(
    (r) => r.hanzi.length > 0,
  );
}

/**
 * Topics with membership narrowed to a level selection, plus how many entries
 * in that selection carry no topic at all — the untagged backlog.
 */
export function topicsAtLevels(levels: Level[]) {
  const chars = new Set(HANZI.filter((h) => levels.includes(h.level)).map((h) => h.char));
  const words = new Set(WORDS.filter((w) => levels.includes(w.level)).map((w) => w.word));
  const topics = TOPICS.map((t) => ({
    ...t,
    hanzi: t.hanzi.filter((c) => chars.has(c)),
    words: t.words.filter((w) => words.has(w)),
  }));
  const untagged =
    HANZI.filter((h) => levels.includes(h.level) && h.topics.length === 0).length +
    WORDS.filter((w) => levels.includes(w.level) && w.topics.length === 0).length;
  return { topics, untagged, total: chars.size + words.size };
}

/** Per-level counts summed over a selection. */
export function countsFor(levels: Level[]) {
  return levels.reduce(
    (acc, l) => ({
      entries: acc.entries + COUNTS[l].entries,
      hanzi: acc.hanzi + COUNTS[l].hanzi,
      words: acc.words + COUNTS[l].words,
      radicals: 0,
    }),
    { entries: 0, hanzi: 0, words: 0, radicals: 0 },
  );
}
