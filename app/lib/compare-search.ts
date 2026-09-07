/**
 * Cross-kind picker search for the compare workspace. Hanzi and words reuse
 * the browse ranking; radicals, phonetics and topics get a lighter matcher
 * on the same tier scale so one list stays ordered.
 */
import { KIND_LABEL, type EntryKind, type EntryRef } from "./compare";
import {
  glossFor,
  matchQuery,
  rankOf,
  searchHanzi,
  searchWords,
  TIER,
  type Filters,
  type Match,
} from "./filters";
import { pinyinMatches } from "./pinyin";
import type { CompareCatalog } from "./detail-data";
import type { PhoneticAnchor, Radical, Topic } from "./types";

export interface CompareHit {
  ref: EntryRef;
  kind: EntryKind;
  title: string;
  reading: string;
  gloss: string;
  rank: number;
  at: [number, number] | null;
}

export interface CompareHitGroup {
  kind: EntryKind;
  label: string;
  hits: CompareHit[];
}

const EMPTY_FILTERS: Omit<Filters, "q"> = {
  radicals: [],
  status: [],
  standards: [],
  topics: [],
  view: "grid",
  group: "radical",
};

const LIMIT: Record<EntryKind, number> = {
  hanzi: 8,
  word: 8,
  radical: 4,
  phonetic: 4,
  topic: 4,
};

const KIND_ORDER: EntryKind[] = ["hanzi", "word", "radical", "phonetic", "topic"];
const CJK = /[一-鿿]/u;

function filtersFor(q: string): Filters {
  return { ...EMPTY_FILTERS, q };
}

function byRank(a: CompareHit, b: CompareHit): number {
  return a.rank - b.rank || a.title.localeCompare(b.title, "zh");
}

function take(hits: CompareHit[], kind: EntryKind): CompareHit[] {
  return [...hits].sort(byRank).slice(0, LIMIT[kind]);
}

function matchRadicalQuery(q: string, r: Radical): Match | null {
  const forms = [r.char, r.canonical, r.display, ...r.variants];
  if (CJK.test(q)) {
    if (forms.some((f) => f === q))
      return { field: "hanzi", index: 0, tier: TIER.hanziExact, at: null };
    if (forms.some((f) => f.includes(q))) {
      return { field: "hanzi", index: 0, tier: TIER.hanziContains, at: null };
    }
    return null;
  }
  if (/^#?\d+$/.test(q)) {
    const n = Number(q.replace("#", ""));
    if (r.number === n) {
      return {
        field: "hanzi",
        index: 0,
        tier: q.startsWith("#") ? TIER.hanziExact : TIER.pinyinExact,
        at: null,
      };
    }
  }
  return matchQuery(q, r.char, [], [r.gloss]);
}

function matchPhoneticQuery(q: string, p: PhoneticAnchor): Match | null {
  if (CJK.test(q)) {
    if (p.component === q || p.anchor === q) {
      return { field: "hanzi", index: 0, tier: TIER.hanziExact, at: null };
    }
    if (p.component.includes(q) || p.anchor.includes(q)) {
      return { field: "hanzi", index: 0, tier: TIER.hanziContains, at: null };
    }
    return null;
  }
  const meanings = p.meaning ? [p.meaning] : [];
  const viaComponent = matchQuery(q, p.component, p.pinyin, meanings);
  if (viaComponent) return viaComponent;
  if (p.anchor !== p.component) {
    const viaAnchor = matchQuery(q, p.anchor, p.pinyin, meanings);
    if (viaAnchor) return viaAnchor;
  }
  if (p.pinyin.some((reading) => pinyinMatches(q, reading))) {
    return matchQuery(q, p.component, p.pinyin, meanings);
  }
  return null;
}

function matchTopicQuery(q: string, t: Topic): Match | null {
  const lower = q.toLowerCase();
  if (t.id === lower)
    return { field: "meaning", index: 0, tier: TIER.hanziExact, at: [0, q.length] };
  const labelMatch = matchQuery(q, "", [], [t.label]);
  if (labelMatch) return labelMatch;
  if (t.id.includes(lower))
    return { field: "meaning", index: 0, tier: TIER.meaningSubstring, at: null };
  return null;
}

function searchRadicals(radicals: Radical[], q: string): CompareHit[] {
  const hits: CompareHit[] = [];
  for (const r of radicals) {
    const match = matchRadicalQuery(q, r);
    if (!match) continue;
    hits.push({
      ref: { kind: "radical", id: r.char },
      kind: "radical",
      title: r.display,
      reading: `Kangxi #${r.number}`,
      gloss: r.gloss,
      rank: rankOf(match),
      at: match.at,
    });
  }
  return take(hits, "radical");
}

function searchPhonetics(phonetics: PhoneticAnchor[], q: string): CompareHit[] {
  const hits: CompareHit[] = [];
  for (const p of phonetics) {
    const match = matchPhoneticQuery(q, p);
    if (!match) continue;
    hits.push({
      ref: { kind: "phonetic", id: p.component },
      kind: "phonetic",
      title: p.component,
      reading: p.pinyin[0] ?? "",
      gloss: p.meaning ?? "",
      rank: rankOf(match),
      at: match.at,
    });
  }
  return take(hits, "phonetic");
}

function searchTopics(topics: Topic[], q: string): CompareHit[] {
  const hits: CompareHit[] = [];
  for (const t of topics) {
    const match = matchTopicQuery(q, t);
    if (!match) continue;
    const gloss =
      match.field === "meaning" ? glossFor([t.label], match) : { text: t.label, at: null };
    hits.push({
      ref: { kind: "topic", id: t.id },
      kind: "topic",
      title: t.label,
      reading: t.id,
      gloss: gloss.text,
      rank: rankOf(match),
      at: gloss.at,
    });
  }
  return take(hits, "topic");
}

export function searchCompare(catalog: CompareCatalog, q: string): CompareHitGroup[] {
  const query = q.trim();
  if (!query) return [];

  const hanziHits: CompareHit[] = take(
    searchHanzi(catalog.hanzi, filtersFor(query)).map(({ h, match }) => {
      const gloss = glossFor(h.meanings, match);
      return {
        ref: { kind: "hanzi" as const, id: h.char },
        kind: "hanzi" as const,
        title: h.char,
        reading: h.pinyin[0] ?? "",
        gloss: gloss.text,
        rank: rankOf(match),
        at: gloss.at,
      };
    }),
    "hanzi",
  );

  const wordHits: CompareHit[] = take(
    searchWords(catalog.words, filtersFor(query)).map(({ w, match }) => {
      const gloss = glossFor(w.meanings, match);
      return {
        ref: { kind: "word" as const, id: w.word },
        kind: "word" as const,
        title: w.word,
        reading: w.pinyin,
        gloss: gloss.text,
        rank: rankOf(match),
        at: gloss.at,
      };
    }),
    "word",
  );

  const grouped: Record<EntryKind, CompareHit[]> = {
    hanzi: hanziHits,
    word: wordHits,
    radical: searchRadicals(catalog.radicals, query),
    phonetic: searchPhonetics(catalog.phonetics, query),
    topic: searchTopics(catalog.topics, query),
  };

  return KIND_ORDER.filter((kind) => grouped[kind].length > 0).map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    hits: grouped[kind],
  }));
}

export function flattenCompareHits(groups: CompareHitGroup[]): CompareHit[] {
  return groups.flatMap((g) => g.hits);
}

export function hitKey(hit: CompareHit): string {
  return `${hit.kind}:${hit.ref.id}`;
}
