import { flattenCompareHits, searchCompare, type CompareHit } from "~/lib/compare-search";
import type { CompareCatalog } from "~/lib/detail-data";
import type { MentionQuery } from "./mentions";
import { matchingKinds } from "./mentions";
import type { MentionKind } from "./types";

const LIMIT = 8;

export interface KindOption {
  kind: MentionKind;
  label: string;
  token: string;
}

export function kindOptions(prefix: string): KindOption[] {
  return matchingKinds(prefix).map((kind) => ({
    kind,
    label: kind === "hanzi" ? "Hanzi" : "Word",
    token: `@/${kind}/`,
  }));
}

export function searchMentions(catalog: CompareCatalog, query: MentionQuery): CompareHit[] {
  const q = query.q.trim();
  if (!q) return [];
  const groups = searchCompare(catalog, q).filter((g) => {
    if (query.kind) return g.kind === query.kind;
    return g.kind === "hanzi" || g.kind === "word";
  });
  return flattenCompareHits(groups).slice(0, LIMIT);
}
