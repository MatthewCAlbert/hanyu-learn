/**
 * Bookmarkable compare-workspace state. Selections live in the query string
 * as typed refs (`hanzi:好`, `word:爱好`) so a split stays shareable.
 */

export const ENTRY_KINDS = ["hanzi", "word", "radical", "phonetic", "topic"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export interface EntryRef {
  kind: EntryKind;
  id: string;
}

export const KIND_LABEL: Record<EntryKind, string> = {
  hanzi: "Hanzi",
  word: "Words",
  radical: "Radicals",
  phonetic: "Phonetics",
  topic: "Topics",
};

export const KIND_LABEL_ONE: Record<EntryKind, string> = {
  hanzi: "Hanzi",
  word: "Word",
  radical: "Radical",
  phonetic: "Phonetic",
  topic: "Topic",
};

const KIND_SET = new Set<string>(ENTRY_KINDS);

export function isEntryKind(value: string): value is EntryKind {
  return KIND_SET.has(value);
}

export type ParsedEntryRef =
  { status: "empty" } | { status: "invalid"; raw: string } | { status: "ok"; ref: EntryRef };

/** Parse one `left`/`right` query value. Null/blank is a vacant pane, not an error. */
export function parseEntryRef(raw: string | null | undefined): ParsedEntryRef {
  const value = raw?.trim() ?? "";
  if (!value) return { status: "empty" };
  const colon = value.indexOf(":");
  if (colon <= 0) return { status: "invalid", raw: value };
  const kind = value.slice(0, colon);
  const id = value.slice(colon + 1).trim();
  if (!isEntryKind(kind) || !id) return { status: "invalid", raw: value };
  return { status: "ok", ref: { kind, id } };
}

export function serializeEntryRef(ref: EntryRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function entryPath(ref: EntryRef): string {
  const id = encodeURIComponent(ref.id);
  switch (ref.kind) {
    case "hanzi":
      return `/hanzi/${id}`;
    case "word":
      return `/words/${id}`;
    case "radical":
      return `/radicals/${id}`;
    case "phonetic":
      return `/phonetic/${id}`;
    case "topic":
      return `/topics/${id}`;
  }
}

export function compareHref(sides: { left?: EntryRef | null; right?: EntryRef | null }): string {
  const params = new URLSearchParams();
  if (sides.left) params.set("left", serializeEntryRef(sides.left));
  if (sides.right) params.set("right", serializeEntryRef(sides.right));
  const search = params.toString();
  return search ? `/compare?${search}` : "/compare";
}

/** Swap the two query values, preserving any unrelated params. */
export function swapCompareSearch(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const left = next.get("left");
  const right = next.get("right");
  if (right) next.set("left", right);
  else next.delete("left");
  if (left) next.set("right", left);
  else next.delete("right");
  return next;
}

export function setCompareSide(
  params: URLSearchParams,
  side: "left" | "right",
  ref: EntryRef | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (ref) next.set(side, serializeEntryRef(ref));
  else next.delete(side);
  return next;
}

export function compareSearchHref(params: URLSearchParams): string {
  const search = params.toString();
  return search ? `/compare?${search}` : "/compare";
}
