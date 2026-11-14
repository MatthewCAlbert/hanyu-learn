/** Seeded search URLs stay short; the textarea accepts a longer paste. */
export const TRANSLATE_QUERY_MAX = 500;
/** Client-side paste cap — several paragraphs, not a novel. */
export const TRANSLATE_TEXT_MAX = 8_000;
/**
 * One photo, not a scan of a book. This caps the file the user picks; what is
 * actually sent is the compressed copy (see `compressImageBlob`), so a full-size
 * phone photo is fine here.
 */
export const TRANSLATE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
/**
 * Longest edge after downscaling. Vision models resize to roughly this anyway,
 * and 2048px keeps small hanzi on signs and menus legible.
 */
export const IMAGE_MAX_EDGE = 2048;
export const IMAGE_JPEG_QUALITY = 0.85;
/** Already small and within IMAGE_MAX_EDGE: re-encoding would only lose quality. */
export const IMAGE_COMPRESS_SKIP_BYTES = 300 * 1024;
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
  grammar: number;
}): boolean {
  return (
    shown.hanzi === 0 &&
    shown.words === 0 &&
    shown.topics === 0 &&
    shown.radicals === 0 &&
    shown.phonetics === 0 &&
    shown.grammar === 0
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
 * Offer Translate when browse has nothing for this query, including pinyin
 * or English. Two or more Hanzi still offer it for sentences even when some
 * characters hit the current collection. Exact catalog entries stay on browse.
 */
export function shouldSuggestTranslate(
  q: string,
  tabsEmpty: boolean,
  exactEntry: boolean,
): boolean {
  const needle = q.trim();
  if (!needle || exactEntry) return false;
  if (tabsEmpty) return true;
  return containsHanzi(q) && hanziCount(q) >= 2;
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

/** Scale (width, height) down to fit within `maxEdge`, keeping aspect ratio. Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = IMAGE_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Downscale and re-encode an image as JPEG in the browser. Returns null when
 * there is nothing to gain or the runtime cannot decode/encode (SSR, tests,
 * old browsers) — the caller then keeps the original bytes.
 */
export async function compressImageBlob(blob: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const resized = width !== bitmap.width || height !== bitmap.height;
    if (!resized && blob.size <= IMAGE_COMPRESS_SKIP_BYTES) return null;

    let out: Blob | null = null;
    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // JPEG has no alpha: paint transparent screenshots onto white, not black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      out = await canvas.convertToBlob({ type: "image/jpeg", quality: IMAGE_JPEG_QUALITY });
    } else if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY),
      );
    }
    if (!out || out.type !== "image/jpeg") return null;
    // A resize is worth keeping even if bytes barely move; a same-size
    // re-encode is only worth it if it actually shrinks the file.
    if (!resized && out.size >= blob.size) return null;
    return out;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

export async function readTranslateImage(
  file: Blob,
  name = "image",
): Promise<{ ok: true; image: TranslateImage } | { ok: false; error: string }> {
  if (file.size > TRANSLATE_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Images must be ${TRANSLATE_IMAGE_MAX_BYTES / 1024 / 1024} MB or smaller.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: "That image is empty." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const typed = isAllowedTranslateImageType(file.type) ? normalizeImageMime(file.type) : sniffImageMime(bytes);
  if (!typed || !isAllowedTranslateImageType(typed)) {
    return { ok: false, error: "Use a PNG, JPEG, or WebP image." };
  }
  const label = "name" in file && typeof file.name === "string" && file.name.trim() ? file.name : name;
  // Compress before it goes anywhere: the data URL is sent to the model, kept
  // in chat history (IndexedDB) and re-sent with every later turn.
  const compressed = await compressImageBlob(file);
  const mime: TranslateImageMime = compressed ? "image/jpeg" : typed;
  const finalBytes = compressed ? new Uint8Array(await compressed.arrayBuffer()) : bytes;
  return {
    ok: true,
    image: {
      dataUrl: `data:${mime};base64,${bytesToBase64(finalBytes)}`,
      mime,
      name: label,
      bytes: finalBytes.byteLength,
    },
  };
}
