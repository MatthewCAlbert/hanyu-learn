import type { CompareHit } from "~/lib/compare-search";
import type { MentionKind, MentionRef } from "./types";
import { MENTION_KINDS, mentionToken } from "./types";

export interface MentionQuery {
  /** Byte offset of the `@` in the full text. */
  start: number;
  /** Exclusive end — usually the caret. */
  end: number;
  raw: string;
  kind: MentionKind | null;
  /** Text after `@/`kind`/` or after `@` when unscoped. */
  q: string;
  /** True when the user is still choosing hanzi vs word (`@/` or `@/han`). */
  choosingKind: boolean;
  kindPrefix: string;
}

const KIND_SET = new Set<string>(MENTION_KINDS);

/**
 * Mentions are `@我`, `@/hanzi/我`, or `@/word/爱好`. They start at `@` that is
 * at the beginning of the string or after whitespace, and run until whitespace.
 */
export function mentionAtCaret(text: string, caret: number): MentionQuery | null {
  const slice = text.slice(0, Math.max(0, caret));
  const at = slice.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(slice[at - 1] ?? "")) return null;
  const raw = slice.slice(at);
  if (/\s/.test(raw)) return null;
  return parseMentionRaw(raw, at, caret);
}

export function parseMentionRaw(raw: string, start = 0, end = start + raw.length): MentionQuery | null {
  if (!raw.startsWith("@")) return null;
  const body = raw.slice(1);

  if (body === "") {
    return {
      start,
      end,
      raw,
      kind: null,
      q: "",
      choosingKind: true,
      kindPrefix: "",
    };
  }

  if (body.startsWith("/")) {
    const rest = body.slice(1);
    const slash = rest.indexOf("/");
    if (slash < 0) {
      return {
        start,
        end,
        raw,
        kind: null,
        q: "",
        choosingKind: true,
        kindPrefix: rest,
      };
    }
    const kind = rest.slice(0, slash);
    const q = rest.slice(slash + 1);
    if (KIND_SET.has(kind)) {
      return {
        start,
        end,
        raw,
        kind: kind as MentionKind,
        q,
        choosingKind: false,
        kindPrefix: kind,
      };
    }
    return {
      start,
      end,
      raw,
      kind: null,
      q,
      choosingKind: true,
      kindPrefix: kind,
    };
  }

  return {
    start,
    end,
    raw,
    kind: null,
    q: body,
    choosingKind: false,
    kindPrefix: "",
  };
}

export function matchingKinds(prefix: string): MentionKind[] {
  const p = prefix.toLowerCase();
  return MENTION_KINDS.filter((k) => k.startsWith(p));
}

/** Complete @/hanzi/… and @/word/… tokens; trailing ?!,.;: stays plain. */
const COMPLETE_MENTION = /(^|\s)(@\/(hanzi|word)\/([^\s?!,.;:]+))/g;

export function extractMentions(text: string): MentionRef[] {
  const refs: MentionRef[] = [];
  const seen = new Set<string>();
  COMPLETE_MENTION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMPLETE_MENTION.exec(text))) {
    const kind = m[3] as MentionKind;
    const id = m[4] ?? "";
    if (!id) continue;
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ kind, id });
  }
  return refs;
}

export function insertMention(
  text: string,
  caret: number,
  ref: MentionRef,
): { text: string; caret: number } {
  const token = mentionToken(ref);
  const active = mentionAtCaret(text, caret);
  if (!active) {
    const next = `${text}${text && !text.endsWith(" ") ? " " : ""}${token} `;
    return { text: next, caret: next.length };
  }
  const next = `${text.slice(0, active.start)}${token} ${text.slice(active.end)}`;
  const nextCaret = active.start + token.length + 1;
  return { text: next, caret: nextCaret };
}

export function mentionFromHit(hit: CompareHit): MentionRef | null {
  if (hit.kind === "hanzi" || hit.kind === "word") {
    return { kind: hit.kind, id: hit.ref.id };
  }
  return null;
}

export type HighlightKind = "plain" | "mention" | "pending";

export interface HighlightSegment {
  text: string;
  kind: HighlightKind;
  mention?: MentionRef;
}

interface MentionRange {
  start: number;
  end: number;
  kind: HighlightKind;
  mention?: MentionRef;
}

function isCompleteMention(query: MentionQuery): boolean {
  return Boolean(query.kind && query.q && query.raw.startsWith(`@/${query.kind}/`));
}

function completeMentionRanges(text: string): MentionRange[] {
  const ranges: MentionRange[] = [];
  COMPLETE_MENTION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMPLETE_MENTION.exec(text))) {
    const token = m[2] ?? "";
    const kind = m[3] as MentionKind | undefined;
    const id = m[4] ?? "";
    const start = (m.index ?? 0) + (m[1]?.length ?? 0);
    ranges.push({
      start,
      end: start + token.length,
      kind: "mention",
      mention: kind && id ? { kind, id } : undefined,
    });
  }
  return ranges;
}

function segmentsFromRanges(text: string, ranges: MentionRange[]): HighlightSegment[] {
  const out: HighlightSegment[] = [];
  let i = 0;
  for (const r of ranges) {
    if (r.start > i) out.push({ text: text.slice(i, r.start), kind: "plain" });
    if (r.end > r.start) {
      out.push({ text: text.slice(r.start, r.end), kind: r.kind, mention: r.mention });
    }
    i = Math.max(i, r.end);
  }
  if (i < text.length) out.push({ text: text.slice(i), kind: "plain" });
  return out;
}

/** Complete @/hanzi and @/word tokens only — no in-progress caret highlight. */
export function segmentMentions(text: string): HighlightSegment[] {
  if (!text) return [];
  return segmentsFromRanges(text, completeMentionRanges(text));
}

/** Split composer text so the overlay can paint @/hanzi and @/word tokens. */
export function highlightComposer(text: string, caret = text.length): HighlightSegment[] {
  if (!text) return [];
  const ranges = completeMentionRanges(text);
  const pending = mentionAtCaret(text, caret);
  if (pending && !isCompleteMention(pending)) {
    const overlaps = ranges.some((r) => pending.start < r.end && pending.end > r.start);
    if (!overlaps) ranges.push({ start: pending.start, end: pending.end, kind: "pending" });
  }
  ranges.sort((a, b) => a.start - b.start);
  return segmentsFromRanges(text, ranges);
}
