import type { HanziIndex, Status, WordIndex } from "./types";
import { type PinyinHit, pinyinRank } from "./pinyin";

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

export const statusOf = (e: { status?: Status; authored?: { status: Status } | null }): Status =>
  e.status ?? e.authored?.status ?? "stub";

/** Where a query hit an entry, and how strongly. */
export interface Match {
  field: "hanzi" | "component" | "pinyin" | "meaning";
  /** Index into that field's array — `meanings[i]` / `pinyin[i]`. 0 otherwise. */
  index: number;
  tier: Tier;
  /** For meaning hits: the `[start, end)` slice of `meanings[index]` that matched. */
  at: [number, number] | null;
}

/**
 * How good a hit is, low to high.
 *
 * One scale interleaving all three writing systems, because a query is
 * genuinely ambiguous and only one list is shown: "wait" is an English word, a
 * prefix of wàitào 外套, and the middle of "waitress". The interleaving is the
 * whole point — `meaningWord` sits above `pinyinPartial` so 等待 "to wait"
 * outranks 外套, which merely happens to start with those four letters.
 *
 * `pinyinPartial` still sits above `meaningSubstring`, though: demote it
 * further and typing "ha" buries 好 under every gloss containing "have",
 * "that" and "chat".
 */
export const TIER = {
  /** The character is the query. */
  hanziExact: 0,
  /** The query is one character of a longer word. */
  hanziContains: 1,
  /** The whole reading: "hao", "hao3" or "hǎo" for hǎo. */
  pinyinExact: 2,
  /** The whole gloss: "good" for "good". */
  meaningExact: 3,
  /** A reading prefix stopping on a syllable boundary: "ai" of "ài hào". */
  pinyinSyllable: 4,
  /** The gloss starts with the query, at a word boundary. */
  meaningPrefix: 5,
  /** The query is a whole word inside a longer gloss. */
  meaningWord: 6,
  /** A reading prefix cutting a syllable: "wait" of "wài tào". */
  pinyinPartial: 7,
  /** The query is a substring of a gloss but not a word: "wait" of "waitress". */
  meaningSubstring: 8,
  /** Structural, not semantic: 女 written inside 好. */
  component: 9,
} as const;
type Tier = (typeof TIER)[keyof typeof TIER];

const CJK = /[一-鿿]/u;

/**
 * Sort key for a match. Tier dominates; the position in `meanings`/`pinyin`
 * breaks ties, so a character's primary sense outranks its seventh. Unmatched
 * sorts last on a *finite* key — `Infinity - Infinity` is `NaN`, which would
 * quietly scramble a comparator when no query is active.
 */
export const rankOf = (m: Match | null): number =>
  m ? m.tier * 1000 + Math.min(m.index, 999) : Number.MAX_SAFE_INTEGER;

/** Is position `i` of `s` outside a run of word characters? */
const isBoundary = (s: string, i: number) => i < 0 || i >= s.length || !/[a-z0-9]/.test(s[i] ?? "");

/**
 * Rate `q` against one English gloss, or null if it does not appear.
 *
 * Deliberately index-based rather than regex-based: the query is user input, so
 * a regex would need escaping, and `\b` misbehaves next to the non-ASCII that
 * turns up in glosses.
 *
 * Every occurrence is scored, not just the first: "awaiting; to wait" opens
 * with the query buried inside a longer word, and the real hit is four words
 * later.
 */
function scoreMeaning(q: string, meaning: string): { tier: Tier; at: [number, number] } | null {
  const lower = meaning.toLowerCase();
  if (lower === q) return { tier: TIER.meaningExact, at: [0, q.length] };
  let best: { tier: Tier; at: [number, number] } | null = null;
  for (let at = lower.indexOf(q); at >= 0; at = lower.indexOf(q, at + q.length)) {
    const end = at + q.length;
    const open = isBoundary(lower, at - 1);
    const close = isBoundary(lower, end);
    const tier: Tier =
      at === 0 && close
        ? TIER.meaningPrefix
        : open && close
          ? TIER.meaningWord
          : TIER.meaningSubstring;
    if (!best || tier < best.tier) best = { tier, at: [at, end] };
    if (best.tier === TIER.meaningPrefix) break; // nothing later can beat it
  }
  return best;
}

/**
 * One search box across three writing systems: type hanzi, pinyin (with or
 * without tones) or English and get the same box to do the right thing.
 *
 * Returns *how* it matched rather than a bare boolean, so filtering, ranking
 * and the gloss shown on the card all read from one source of truth.
 */
export function matchQuery(
  q: string,
  hanzi: string,
  pinyins: string[],
  meanings: string[],
): Match | null {
  if (!q) return null;

  if (CJK.test(q)) {
    if (hanzi === q) return { field: "hanzi", index: 0, tier: TIER.hanziExact, at: null };
    const at = hanzi.indexOf(q);
    if (at >= 0) return { field: "hanzi", index: at, tier: TIER.hanziContains, at: null };
    return null;
  }

  let best: Match | null = null;
  const PINYIN_TIER: Record<PinyinHit, Tier> = {
    exact: TIER.pinyinExact,
    syllable: TIER.pinyinSyllable,
    partial: TIER.pinyinPartial,
  };
  for (let i = 0; i < pinyins.length; i += 1) {
    const hit = pinyinRank(q, pinyins[i]!);
    if (!hit) continue;
    const tier = PINYIN_TIER[hit];
    if (!best || tier < best.tier) best = { field: "pinyin", index: i, tier, at: null };
  }
  // A whole reading cannot be beaten, so the glosses need not be walked. Any
  // weaker pinyin hit still can be — that is what keeps 等待 "to wait" above
  // 外套 wàitào for the query "wait".
  if (best?.tier === TIER.pinyinExact) return best;

  const lower = q.toLowerCase();
  for (let i = 0; i < meanings.length; i += 1) {
    const hit = scoreMeaning(lower, meanings[i]!);
    if (!hit) continue;
    if (!best || hit.tier < best.tier) best = { field: "meaning", index: i, ...hit };
    if (best.tier === TIER.meaningExact) break; // nothing can beat it
  }
  return best;
}

/**
 * The clause of a gloss that actually matched.
 *
 * Character glosses arrive from the dictionary as one semicolon-joined blob
 * ("to wait, to expect; to visit; to greet"), which truncates to noise in an
 * 84px cell. Showing just the clause carrying the hit keeps the answer visible.
 */
function matchedClause(
  meaning: string,
  at: [number, number] | null,
): { text: string; at: [number, number] | null } {
  if (!at || !meaning.includes(";")) return { text: meaning, at };
  let start = 0;
  for (const clause of meaning.split(";")) {
    const end = start + clause.length;
    if (at[0] >= start && at[1] <= end) {
      const lead = clause.length - clause.trimStart().length;
      const from = start + lead;
      return { text: clause.trim(), at: [at[0] - from, at[1] - from] };
    }
    start = end + 1; // the ";" itself
  }
  return { text: meaning, at };
}

/**
 * The gloss to print on a card, and the slice of it to highlight.
 *
 * A row that matched the reader's query on its sixth sense has to say so, or
 * the card looks like a false hit: searching "wait" showed 等 as "class", its
 * first gloss, with nothing on screen explaining why it was there. So the
 * matched gloss leads and the rest follow, up to `limit`.
 */
export function glossFor(
  meanings: string[],
  match: Match | null,
  limit = 1,
): { text: string; at: [number, number] | null } {
  if (match?.field !== "meaning") {
    return { text: meanings.slice(0, limit).join("; "), at: null };
  }
  const hit = matchedClause(meanings[match.index] ?? "", match.at);
  const rest = meanings.filter((_, i) => i !== match.index);
  // The hit leads, so its offsets survive the join unshifted.
  return { text: [hit.text, ...rest].slice(0, limit).join("; "), at: hit.at };
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

type HanziRow = Pick<
  HanziIndex,
  | "char"
  | "pinyin"
  | "meanings"
  | "radical"
  | "radicalCanonical"
  | "components"
  | "standards"
  | "topics"
> & { status?: Status; authored?: { status: Status } | null };

type WordRow = Pick<WordIndex, "word" | "pinyin" | "meanings" | "standards" | "topics"> & {
  status?: Status;
  authored?: { status: Status } | null;
};

/**
 * Matching hanzi, each carrying *why* it matched so the list can rank by it and
 * the card can show the gloss the reader actually searched for. `match` is null
 * whenever the search box is empty — a filter pass is not a match.
 */
export function searchHanzi<T extends HanziRow>(
  list: T[],
  f: Filters,
): { h: T; match: Match | null }[] {
  const out: { h: T; match: Match | null }[] = [];
  for (const h of list) {
    if (f.radicals.length && !f.radicals.includes(h.radicalCanonical)) continue;
    if (f.status.length && !f.status.includes(statusOf(h))) continue;
    if (!matchesStandards(f, h.standards)) continue;
    if (!matchesTopics(f, h.topics)) continue;
    if (!f.q) {
      out.push({ h, match: null });
      continue;
    }
    let match = matchQuery(f.q, h.char, h.pinyin, h.meanings);
    // A hanzi also matches on its components, so searching 女 finds 好 and 妈 —
    // a weaker hit than the character itself, and ranked as one.
    if (!match && CJK.test(f.q)) {
      const related = h.components.includes(f.q) || h.radical === f.q || h.radicalCanonical === f.q;
      // `indexOf` is -1 when only the radical matched, and -1 would sort ahead
      // of a genuine first component.
      if (related) {
        const index = Math.max(0, h.components.indexOf(f.q));
        match = { field: "component", index, tier: TIER.component, at: null };
      }
    }
    if (match) out.push({ h, match });
  }
  return out;
}

export function searchWords<T extends WordRow>(
  list: T[],
  f: Filters,
): { w: T; match: Match | null }[] {
  const out: { w: T; match: Match | null }[] = [];
  for (const w of list) {
    if (f.status.length && !f.status.includes(statusOf(w))) continue;
    if (!matchesStandards(f, w.standards)) continue;
    if (!matchesTopics(f, w.topics)) continue;
    if (f.radicals.length) continue; // radical filter is hanzi-only
    if (!f.q) {
      out.push({ w, match: null });
      continue;
    }
    const match = matchQuery(f.q, w.word, [w.pinyin], w.meanings);
    if (match) out.push({ w, match });
  }
  return out;
}

export const filterHanzi = <T extends HanziRow>(list: T[], f: Filters): T[] =>
  searchHanzi(list, f).map((x) => x.h);

export const filterWords = <T extends WordRow>(list: T[], f: Filters): T[] =>
  searchWords(list, f).map((x) => x.w);

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
