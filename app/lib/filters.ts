import type { Hanzi, Status, Word } from "./types";
import { pinyinMatches } from "./pinyin";

/** Reserved topic filter value: entries carrying no topic at all. */
export const UNTAGGED = "untagged";

export interface Filters {
  q: string;
  radicals: string[];
  status: Status[];
  /** Other HSK standards an entry also appears in, e.g. "old-1". */
  standards: string[];
  /** Topic ids, plus the reserved `untagged`. */
  topics: string[];
  view: "grid" | "table";
  group: "radical" | "frequency" | "topic";
}

/** How many rows the list has been asked to reveal so far. */
export const PAGE_INITIAL = 1000;
export const PAGE_STEP = 100;

export function readTake(params: URLSearchParams): number {
  const n = Number(params.get("take"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100_000) : PAGE_INITIAL;
}

export function readFilters(params: URLSearchParams): Filters {
  const view = params.get("view");
  const group = params.get("group");
  return {
    q: params.get("q")?.trim() ?? "",
    radicals: params.getAll("r"),
    status: params.getAll("s") as Status[],
    standards: params.getAll("std"),
    topics: params.getAll("topic"),
    view: view === "table" ? "table" : "grid",
    group: group === "frequency" || group === "topic" ? group : "radical",
  };
}

export const statusOf = (e: { authored: { status: Status } | null }): Status =>
  e.authored?.status ?? "stub";

/**
 * One search box across three writing systems: type hanzi, pinyin (with or
 * without tones) or English and get the same box to do the right thing.
 */
function matchesQuery(q: string, hanzi: string, pinyins: string[], meanings: string[]): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (/[一-鿿]/u.test(q)) return hanzi.includes(q);
  if (pinyins.some((p) => pinyinMatches(q, p))) return true;
  return meanings.some((m) => m.toLowerCase().includes(lower));
}

const matchesStandards = (f: Filters, standards: string[]) =>
  f.standards.length === 0 || f.standards.some((t) => standards.includes(t));

/**
 * `untagged` selects entries with no topic at all, so it and the real topic ids
 * together partition the corpus.
 */
const matchesTopics = (f: Filters, topics: string[]) => {
  if (f.topics.length === 0) return true;
  if (f.topics.includes(UNTAGGED) && topics.length === 0) return true;
  return f.topics.some((t) => topics.includes(t));
};

export function filterHanzi(list: Hanzi[], f: Filters): Hanzi[] {
  return list.filter((h) => {
    if (f.radicals.length && !f.radicals.includes(h.radicalCanonical)) return false;
    if (f.status.length && !f.status.includes(statusOf(h))) return false;
    if (!matchesStandards(f, h.standards)) return false;
    if (!matchesTopics(f, h.topics)) return false;
    // A hanzi also matches on its components, so searching 女 finds 好 and 妈.
    if (f.q && /[一-鿿]/u.test(f.q)) {
      return (
        h.char.includes(f.q) ||
        h.components.includes(f.q) ||
        h.radical === f.q ||
        h.radicalCanonical === f.q
      );
    }
    return matchesQuery(f.q, h.char, h.pinyin, h.meanings);
  });
}

export function filterWords(list: Word[], f: Filters): Word[] {
  return list.filter((w) => {
    if (f.status.length && !f.status.includes(statusOf(w))) return false;
    if (!matchesStandards(f, w.standards)) return false;
    if (!matchesTopics(f, w.topics)) return false;
    if (f.radicals.length) return false; // radical filter is hanzi-only
    return matchesQuery(f.q, w.word, [w.pinyin], w.meanings);
  });
}

/** Build a search-param string, dropping empties so URLs stay clean. */
export function toSearch(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  f.radicals?.forEach((r) => p.append("r", r));
  f.status?.forEach((s) => p.append("s", s));
  f.standards?.forEach((t) => p.append("std", t));
  f.topics?.forEach((t) => p.append("topic", t));
  if (f.view && f.view !== "grid") p.set("view", f.view);
  if (f.group && f.group !== "radical") p.set("group", f.group);
  const s = p.toString();
  return s ? `?${s}` : "";
}
