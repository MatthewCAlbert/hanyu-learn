/** Seeded search URLs stay short; the textarea accepts a longer paste. */
export const TRANSLATE_QUERY_MAX = 500;
/** Client-side paste cap — several paragraphs, not a novel. */
export const TRANSLATE_TEXT_MAX = 8_000;
/** One photo, not a scan of a book. */
export const TRANSLATE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const TRANSLATE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type TranslateImageMime = (typeof TRANSLATE_IMAGE_TYPES)[number];

export interface TranslateImage {
  dataUrl: string;
  mime: TranslateImageMime;
  name: string;
  bytes: number;
}

const CJK = /[一-鿿]/u;

export function containsHanzi(q: string): boolean {
  return CJK.test(q);
}

export function hanziCount(q: string): number {
  return [...q].filter((ch) => CJK.test(ch)).length;
}

export function capText(
  text: string,
  max = TRANSLATE_TEXT_MAX,
): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

export function translateHref(q: string): string {
  const trimmed = q.trim();
  if (!trimmed) return "/translate";
  const seeded = trimmed.length > TRANSLATE_QUERY_MAX ? trimmed.slice(0, TRANSLATE_QUERY_MAX) : trimmed;
  return `/translate?${new URLSearchParams({ q: seeded })}`;
}

export function readTranslateQuery(params: URLSearchParams): string {
  return params.get("q")?.trim() ?? "";
}

export function browseSearchEmpty(shown: {
  hanzi: number;
  words: number;
  topics: number;
  radicals: number;
  phonetics: number;
}): boolean {
  return (
    shown.hanzi === 0 &&
    shown.words === 0 &&
    shown.topics === 0 &&
    shown.radicals === 0 &&
    shown.phonetics === 0
  );
}

/** True when the trimmed query is exactly one corpus hanzi or word, any level. */
export function isExactCorpusEntry(
  catalog: { hanzi: readonly { char: string }[]; words: readonly { word: string }[] },
  q: string,
): boolean {
  const needle = q.trim();
  if (!needle) return false;
  if (catalog.hanzi.some((h) => h.char === needle)) return true;
  if (catalog.words.some((w) => w.word === needle)) return true;
  return false;
}

/**
 * Offer the translate workspace for Hanzi-bearing queries that are not an
 * exact corpus entry. Empty browse results cover unknown glyphs; two or more
 * Hanzi cover full-sentence search even when individual characters still hit.
 */
export function shouldSuggestTranslate(
  q: string,
  tabsEmpty: boolean,
  exactEntry: boolean,
): boolean {
  if (!containsHanzi(q) || exactEntry) return false;
  return tabsEmpty || hanziCount(q) >= 2;
}

/** Pinyin, English, or other freeform — local segmentation cannot help. */
export function needsAiForSource(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !containsHanzi(trimmed);
}

export function normalizeImageMime(type: string): string {
  const trimmed = type.trim().toLowerCase();
  if (trimmed === "image/jpg") return "image/jpeg";
  return trimmed;
}

export function isAllowedTranslateImageType(type: string): type is TranslateImageMime {
  const mime = normalizeImageMime(type);
  return (TRANSLATE_IMAGE_TYPES as readonly string[]).includes(mime);
}

/** Magic-byte fallback when the clipboard or OS omits a MIME type. */
export function sniffImageMime(bytes: Uint8Array): TranslateImageMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of data.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && (isAllowedTranslateImageType(file.type) || file.type === "" || file.type === "application/octet-stream")) {
      return file;
    }
  }
  for (const file of data.files) {
    if (isAllowedTranslateImageType(file.type) || file.type === "" || file.type === "application/octet-stream") {
      return file;
    }
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(bytes).toString("base64");
}

export async function readTranslateImage(
  file: Blob,
  name = "image",
): Promise<{ ok: true; image: TranslateImage } | { ok: false; error: string }> {
  if (file.size > TRANSLATE_IMAGE_MAX_BYTES) {
    return { ok: false, error: "Images must be 10 MB or smaller." };
  }
  if (file.size === 0) {
    return { ok: false, error: "That image is empty." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const typed = isAllowedTranslateImageType(file.type) ? normalizeImageMime(file.type) : sniffImageMime(bytes);
  if (!typed || !isAllowedTranslateImageType(typed)) {
    return { ok: false, error: "Use a PNG, JPEG, or WebP image." };
  }
  const mime = typed;
  const label = "name" in file && typeof file.name === "string" && file.name.trim() ? file.name : name;
  return {
    ok: true,
    image: {
      dataUrl: `data:${mime};base64,${bytesToBase64(bytes)}`,
      mime,
      name: label,
      bytes: file.size,
    },
  };
}
