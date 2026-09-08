import { textbookPercentiles } from "./lexical";
import type { Relation, RelationCandidate, Word } from "./types";

const WIKI = /\[\[([^\]]+)\]\]/g;

export function wikiTargets(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(WIKI)) {
    const target = m[1]?.trim();
    if (target && !out.includes(target)) out.push(target);
  }
  return out;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort((x, y) => x.localeCompare(y, "zh")).join("|");
}

/**
 * Deterministic review queue from the authored corpus. Does not download
 * restricted corpora. Each candidate keeps source labels instead of a fused score.
 */
export function buildRelationCandidates(args: {
  words: Word[];
  relations: Relation[];
}): RelationCandidate[] {
  const { words, relations } = args;
  const percentiles = textbookPercentiles(words);
  const related = new Set<string>();
  for (const r of relations) {
    const forms = r.members.map((m) => m.form);
    for (let i = 0; i < forms.length; i += 1) {
      for (let j = i + 1; j < forms.length; j += 1) {
        related.add(pairKey(forms[i]!, forms[j]!));
      }
    }
  }
  const covered = new Set(relations.flatMap((r) => r.members.map((m) => m.form)));
  const byWord = new Map(words.map((w) => [w.word, w]));
  const out: RelationCandidate[] = [];
  const seen = new Set<string>();

  const push = (c: RelationCandidate) => {
    const key = `${c.kind}:${c.forms.join("|")}:${c.reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  for (const w of words) {
    const notes = [w.authored?.notes, w.authored?.why].filter(Boolean).join("\n");
    for (const target of wikiTargets(notes)) {
      if (!byWord.has(target) || target === w.word) continue;
      if (related.has(pairKey(w.word, target))) continue;
      push({
        reason: "wikilink in authored notes is not yet a relation member pair",
        forms: [w.word, target],
        kind: "synonym-set",
        sources: ["authored-notes"],
        textbookPercentile: percentiles.get(w.word) ?? null,
      });
    }
    if (
      w.authored?.formation === "phonetic-loan" &&
      (w.authored.chars.length === 0 ||
        w.authored.chars.every((c) => c.role !== "transliteration"))
    ) {
      push({
        reason: "phonetic-loan without a transliteration character link",
        forms: [w.word],
        kind: "char-link",
        sources: ["formation"],
        textbookPercentile: percentiles.get(w.word) ?? null,
      });
    }
    if (w.authored?.transparency === "opaque" && w.authored.chars.length === 0) {
      push({
        reason: "opaque word with no character-contribution overlay",
        forms: [w.word],
        kind: "char-link",
        sources: ["transparency"],
        textbookPercentile: percentiles.get(w.word) ?? null,
      });
    }
    if (!w.extra && !covered.has(w.word) && !w.authored?.usage) {
      const pct = percentiles.get(w.word);
      if (pct != null && pct >= 80) {
        push({
          reason: "high textbook-frequency word with no usage profile or relation",
          forms: [w.word],
          kind: "usage",
          sources: ["hsk-frequency"],
          textbookPercentile: pct,
        });
      }
    }
  }

  out.sort((a, b) => {
    const pa = a.textbookPercentile ?? -1;
    const pb = b.textbookPercentile ?? -1;
    if (pa !== pb) return pb - pa;
    return a.forms.join(" ").localeCompare(b.forms.join(" "), "zh");
  });
  return out;
}
