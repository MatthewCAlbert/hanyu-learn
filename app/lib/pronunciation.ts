/**
 * Resolve a form + reading to recorded audio, without playing it.
 *
 * Word clips are keyed by Hanzi form. Syllable clips are keyed by numeric
 * pinyin (`hao3`). Neutral tone has no recordings in the vendored bank —
 * substituting first-tone audio would be a lie, so the plan falls through.
 */
import { splitTone } from "./pinyin";

export interface PinyinSyllable {
  base: string;
  tone: number;
}

export type PronunciationPlan =
  | { kind: "word"; form: string }
  | { kind: "syllables"; keys: string[] }
  | { kind: "tts"; text: string }
  | { kind: "unavailable"; reason: "no-audio" | "no-voice" };

export interface PronunciationAvailability {
  hasWord: (form: string) => boolean;
  hasSyllable: (key: string) => boolean;
  canSpeak: boolean;
}

/** Isolated erhua marker (`nǎ r`, `wán r`) — not a syllable we can play. */
const ERHUA_R = /^r[1-5]?$/i;

export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(readonly capacity: number) {
    if (capacity < 1) throw new Error("LruCache capacity must be >= 1");
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }
}

/**
 * Space-separated syllables of a reading. Concatenated pinyin (`jiànguò`)
 * stays one token — the resolver will not pretend it knows the split.
 */
export function pinyinSyllables(pinyin: string): PinyinSyllable[] {
  return pinyin
    .split(/[\s'·]+/)
    .filter(Boolean)
    .filter((token) => !ERHUA_R.test(token))
    .map((token) => {
      const { base, tone } = splitTone(token);
      return { base: base.replace(/ü/g, "v").replace(/[^a-z]/g, ""), tone };
    })
    .filter((syllable) => syllable.base.length > 0);
}

/** Filename key for a tone 1–4 syllable, or null when there is no honest clip. */
export function syllableAudioKey(syllable: PinyinSyllable): string | null {
  if (syllable.tone < 1 || syllable.tone > 4) return null;
  return `${syllable.base}${syllable.tone}`;
}

export function sourceWordFilename(form: string): string {
  return `cmn-${form}.mp3`;
}

export function sourceSyllableFilename(key: string): string {
  return `cmn-${key}.mp3`;
}

/** Directory that contains `hsk/` and `syllabs/`. Empty env → recorded clips are off. */
export function audioCdnBase(raw = import.meta.env.CDN_AUDIO_URL): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function cdnWordUrl(base: string, form: string): string {
  return `${base}/hsk/cmn-${encodeURIComponent(form)}.mp3`;
}

export function cdnSyllableUrl(base: string, key: string): string {
  return `${base}/syllabs/${sourceSyllableFilename(key)}`;
}

/**
 * Prefer an exact word recording when asked (words/lexemes). Hanzi always
 * uses the selected reading's syllables so 好 hǎo and 好 hào stay distinct.
 */
export function resolvePronunciation(
  form: string,
  pinyin: string,
  opts: { preferWordClip: boolean; availability: PronunciationAvailability },
): PronunciationPlan {
  if (opts.preferWordClip && opts.availability.hasWord(form)) {
    return { kind: "word", form };
  }

  const keys: string[] = [];
  for (const syllable of pinyinSyllables(pinyin)) {
    const key = syllableAudioKey(syllable);
    if (!key || !opts.availability.hasSyllable(key)) {
      if (opts.availability.canSpeak) return { kind: "tts", text: form };
      return { kind: "unavailable", reason: "no-audio" };
    }
    keys.push(key);
  }

  if (keys.length > 0) return { kind: "syllables", keys };
  if (opts.availability.canSpeak) return { kind: "tts", text: form };
  return { kind: "unavailable", reason: "no-audio" };
}
