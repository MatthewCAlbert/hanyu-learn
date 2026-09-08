import type { HanziIndex, Level, WordIndex } from "./types";
import { TRANSLATE_TEXT_MAX, capText } from "./translate";

const HANZI_RE = /[一-鿿]/u;
const PUNCT_RE = /[\p{P}\p{S}]/u;

export type SegmentKind = "word" | "hanzi" | "unknown" | "punct" | "other";

export interface CorpusRef {
  kind: "word" | "hanzi";
  id: string;
}

export interface CandidateSummary {
  pinyin: string;
  meaning: string;
  level: Level | null;
  extra: boolean;
}

export interface CorpusCandidate {
  id: string;
  text: string;
  kind: "word" | "hanzi";
  start: number;
  end: number;
  summary: CandidateSummary;
}

export interface TextSpan {
  id: string;
  text: string;
  kind: SegmentKind;
  start: number;
  end: number;
  ref?: CorpusRef;
  summary?: CandidateSummary;
  candidates: CorpusCandidate[];
}

export interface TextBlock {
  id: string;
  text: string;
  spans: TextSpan[];
  source: { kind: "line"; index: number };
}

export interface TextAnalysis {
  blocks: TextBlock[];
  truncated: boolean;
}

export interface SegmentCatalog {
  hanzi: readonly Pick<HanziIndex, "char" | "pinyin" | "meanings" | "level">[];
  words: readonly Pick<WordIndex, "word" | "pinyin" | "meanings" | "level" | "extra">[];
}

export interface Lexicon {
  words: Map<string, CandidateSummary>;
  hanzi: Map<string, CandidateSummary>;
  maxWordLen: number;
}

function gloss(meanings: readonly string[]): string {
  return meanings[0] ?? "";
}

export function buildLexicon(catalog: SegmentCatalog): Lexicon {
  const words = new Map<string, CandidateSummary>();
  const hanzi = new Map<string, CandidateSummary>();
  let maxWordLen = 1;
  for (const w of catalog.words) {
    const chars = [...w.word];
    if (chars.length === 0) continue;
    if (chars.length > maxWordLen) maxWordLen = chars.length;
    words.set(w.word, {
      pinyin: w.pinyin,
      meaning: gloss(w.meanings),
      level: w.extra ? null : w.level,
      extra: w.extra,
    });
  }
  for (const h of catalog.hanzi) {
    hanzi.set(h.char, {
      pinyin: h.pinyin[0] ?? "",
      meaning: gloss(h.meanings),
      level: h.level,
      extra: false,
    });
  }
  return { words, hanzi, maxWordLen };
}

function kindAt(ch: string): "hanzi" | "punct" | "other" {
  if (HANZI_RE.test(ch)) return "hanzi";
  if (PUNCT_RE.test(ch) || ch === "·" || ch === "•") return "punct";
  return "other";
}

function longestWord(lexicon: Lexicon, chars: string[], from: number, until: number): number {
  const limit = Math.min(lexicon.maxWordLen, until - from);
  for (let len = limit; len >= 2; len--) {
    const slice = chars.slice(from, from + len).join("");
    if (lexicon.words.has(slice)) return len;
  }
  return 0;
}

function primaryAt(
  lexicon: Lexicon,
  chars: string[],
  from: number,
  until: number,
): { len: number; kind: SegmentKind; ref?: CorpusRef; summary?: CandidateSummary } {
  const wordLen = longestWord(lexicon, chars, from, until);
  if (wordLen >= 2) {
    const text = chars.slice(from, from + wordLen).join("");
    const summary = lexicon.words.get(text);
    return { len: wordLen, kind: "word", ref: { kind: "word", id: text }, summary };
  }
  const ch = chars[from];
  if (!ch) return { len: 1, kind: "other" };
  const asWord = lexicon.words.get(ch);
  if (asWord) return { len: 1, kind: "word", ref: { kind: "word", id: ch }, summary: asWord };
  const asHanzi = lexicon.hanzi.get(ch);
  if (asHanzi) return { len: 1, kind: "hanzi", ref: { kind: "hanzi", id: ch }, summary: asHanzi };
  if (HANZI_RE.test(ch)) return { len: 1, kind: "unknown" };
  return { len: 1, kind: kindAt(ch) === "punct" ? "punct" : "other" };
}

interface RawSpan {
  start: number;
  end: number;
  kind: SegmentKind;
  ref?: CorpusRef;
  summary?: CandidateSummary;
}

function tokenizeLine(lexicon: Lexicon, chars: string[]): RawSpan[] {
  const out: RawSpan[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (!ch) break;
    const bucket = kindAt(ch);
    if (bucket !== "hanzi") {
      let j = i + 1;
      while (j < chars.length) {
        const next = chars[j];
        if (!next || kindAt(next) !== bucket) break;
        j++;
      }
      out.push({ start: i, end: j, kind: bucket });
      i = j;
      continue;
    }
    let runEnd = i + 1;
    while (runEnd < chars.length) {
      const next = chars[runEnd];
      if (!next || kindAt(next) !== "hanzi") break;
      runEnd++;
    }
    let pos = i;
    while (pos < runEnd) {
      const primary = primaryAt(lexicon, chars, pos, runEnd);
      out.push({
        start: pos,
        end: pos + primary.len,
        kind: primary.kind,
        ref: primary.ref,
        summary: primary.summary,
      });
      pos += primary.len;
    }
    i = runEnd;
  }
  return out;
}

function candidatesInRange(
  lexicon: Lexicon,
  chars: string[],
  start: number,
  end: number,
  blockId: string,
  spanIndex: number,
): CorpusCandidate[] {
  const found: CorpusCandidate[] = [];
  const seen = new Set<string>();
  let n = 0;
  const push = (text: string, kind: "word" | "hanzi", from: number, to: number, summary: CandidateSummary) => {
    const key = `${kind}:${text}:${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      id: `${blockId}.s${spanIndex}.c${n}`,
      text,
      kind,
      start: from,
      end: to,
      summary,
    });
    n += 1;
  };
  for (let from = start; from < end; from++) {
    const ch = chars[from];
    if (!ch) continue;
    const hanzi = lexicon.hanzi.get(ch);
    if (hanzi) push(ch, "hanzi", from, from + 1, hanzi);
    const asWord = lexicon.words.get(ch);
    if (asWord) push(ch, "word", from, from + 1, asWord);
    const limit = Math.min(lexicon.maxWordLen, end - from);
    for (let len = 2; len <= limit; len++) {
      const text = chars.slice(from, from + len).join("");
      const summary = lexicon.words.get(text);
      if (summary) push(text, "word", from, from + len, summary);
    }
  }
  return found;
}

/** Words in a CJK run that cross a primary-token boundary. */
function crossBoundaryWords(
  lexicon: Lexicon,
  chars: string[],
  spans: RawSpan[],
  runStart: number,
  runEnd: number,
): { text: string; start: number; end: number; summary: CandidateSummary; attach: number }[] {
  const extras: { text: string; start: number; end: number; summary: CandidateSummary; attach: number }[] = [];
  const seen = new Set<string>();
  for (let from = runStart; from < runEnd; from++) {
    const limit = Math.min(lexicon.maxWordLen, runEnd - from);
    for (let len = 2; len <= limit; len++) {
      const end = from + len;
      const text = chars.slice(from, end).join("");
      const summary = lexicon.words.get(text);
      if (!summary) continue;
      const owner = spans.findIndex((s) => s.start <= from && end <= s.end);
      if (owner >= 0) continue;
      const attach = spans.findIndex((s) => s.start < end && s.end > from);
      if (attach < 0) continue;
      const key = `${text}:${from}`;
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push({ text, start: from, end, summary, attach });
    }
  }
  return extras;
}

function analyzeLine(lexicon: Lexicon, text: string, blockIndex: number): TextBlock {
  const id = `p${blockIndex}`;
  const chars = [...text];
  const raw = tokenizeLine(lexicon, chars);
  const extras = new Map<number, CorpusCandidate[]>();
  let runStart = -1;
  const flushRun = (runEnd: number) => {
    if (runStart < 0) return;
    for (const extra of crossBoundaryWords(lexicon, chars, raw, runStart, runEnd)) {
      const list = extras.get(extra.attach) ?? [];
      list.push({
        id: `${id}.x${extra.start}-${extra.end}`,
        text: extra.text,
        kind: "word",
        start: extra.start,
        end: extra.end,
        summary: extra.summary,
      });
      extras.set(extra.attach, list);
    }
    runStart = -1;
  };
  for (const span of raw) {
    if (span.kind === "word" || span.kind === "hanzi" || span.kind === "unknown") {
      if (runStart < 0) runStart = span.start;
    } else {
      flushRun(span.start);
    }
  }
  flushRun(chars.length);

  const spans: TextSpan[] = raw.map((span, spanIndex) => {
    const piece = chars.slice(span.start, span.end).join("");
    const contained =
      span.kind === "punct" || span.kind === "other"
        ? []
        : candidatesInRange(lexicon, chars, span.start, span.end, id, spanIndex);
    const crossed = extras.get(spanIndex) ?? [];
    const candidates = [...contained];
    const seen = new Set(contained.map((c) => `${c.kind}:${c.text}:${c.start}`));
    for (const extra of crossed) {
      const key = `${extra.kind}:${extra.text}:${extra.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ ...extra, id: `${id}.s${spanIndex}.c${candidates.length}` });
    }
    return {
      id: `${id}.s${spanIndex}`,
      text: piece,
      kind: span.kind,
      start: span.start,
      end: span.end,
      ref: span.ref,
      summary: span.summary,
      candidates,
    };
  });

  return { id, text, spans, source: { kind: "line", index: blockIndex } };
}

export function analyzeText(
  raw: string,
  lexicon: Lexicon,
  max = TRANSLATE_TEXT_MAX,
): TextAnalysis {
  const { text, truncated } = capText(raw, max);
  const lines = text.split("\n");
  return {
    blocks: lines.map((line, i) => analyzeLine(lexicon, line, i)),
    truncated,
  };
}

export function spanById(analysis: TextAnalysis, spanId: string): TextSpan | undefined {
  for (const block of analysis.blocks) {
    const span = block.spans.find((s) => s.id === spanId);
    if (span) return span;
  }
  return undefined;
}

export function blockById(analysis: TextAnalysis, blockId: string): TextBlock | undefined {
  return analysis.blocks.find((b) => b.id === blockId);
}

/** Non-empty lines sent to the model, including pinyin or English. */
export function sourceBlocks(analysis: TextAnalysis): TextBlock[] {
  return analysis.blocks.filter((b) => b.text.trim().length > 0);
}

/** Paragraphs that actually have CJK, so the model is not asked to translate blank lines. */
export function translatableBlocks(analysis: TextAnalysis): TextBlock[] {
  return analysis.blocks.filter((b) =>
    b.spans.some((s) => s.kind === "word" || s.kind === "hanzi" || s.kind === "unknown"),
  );
}

export function blockHasHanzi(block: TextBlock): boolean {
  return block.spans.some((s) => s.kind === "word" || s.kind === "hanzi" || s.kind === "unknown");
}
