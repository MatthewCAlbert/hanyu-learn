/**
 * Pinyin normalization so that `hao`, `hao3` and `hǎo` all match one another.
 *
 * The dataset gives us tone-marked pinyin ("ài hào"); learners type any of the
 * three forms, so search normalizes both sides to a common key.
 */

const TONE_MARKS: Record<string, [base: string, tone: number]> = {
  ā: ["a", 1],
  á: ["a", 2],
  ǎ: ["a", 3],
  à: ["a", 4],
  ē: ["e", 1],
  é: ["e", 2],
  ě: ["e", 3],
  è: ["e", 4],
  ī: ["i", 1],
  í: ["i", 2],
  ǐ: ["i", 3],
  ì: ["i", 4],
  ō: ["o", 1],
  ó: ["o", 2],
  ǒ: ["o", 3],
  ò: ["o", 4],
  ū: ["u", 1],
  ú: ["u", 2],
  ǔ: ["u", 3],
  ù: ["u", 4],
  ǖ: ["ü", 1],
  ǘ: ["ü", 2],
  ǚ: ["ü", 3],
  ǜ: ["ü", 4],
  ń: ["n", 2],
  ň: ["n", 3],
  ǹ: ["n", 4],
  ḿ: ["m", 2],
};

/** "hǎo" -> { base: "hao", tone: 3 }. Tone 0 means neutral/unmarked. */
export function splitTone(syllable: string): { base: string; tone: number } {
  let tone = 0;
  let base = "";
  for (const ch of syllable.toLowerCase()) {
    const mark = TONE_MARKS[ch];
    if (mark) {
      base += mark[0];
      tone = mark[1];
    } else {
      base += ch;
    }
  }
  // trailing digit form, e.g. "hao3"
  const digit = /^(.*?)([0-5])$/.exec(base);
  if (digit) {
    base = digit[1]!;
    tone = Number(digit[2]);
  }
  return { base, tone };
}

/** Toneless, spaceless, ü-folded key. "ài hào" and "ai4hao4" -> "aihao". */
export function toneless(pinyin: string): string {
  return pinyin
    .split(/[\s'·]+/)
    .map((s) => splitTone(s).base)
    .join("")
    .replace(/ü/g, "v")
    .replace(/[^a-z]/g, "");
}

/** Tone-preserving numeric key. "hǎo" -> "hao3"; untoned stays untoned. */
export function numeric(pinyin: string): string {
  return pinyin
    .split(/[\s'·]+/)
    .filter(Boolean)
    .map((s) => {
      const { base, tone } = splitTone(s);
      return base.replace(/ü/g, "v") + (tone ? String(tone) : "");
    })
    .join("");
}

/**
 * How well `query` matches `pinyin`, or null if it does not.
 *
 * A query that stops on a syllable boundary ("ai" of "ài hào") is someone
 * typing pinyin. One that cuts a syllable in half ("wait" of "wài tào") is
 * usually an English word colliding with pinyin, so the two are reported apart
 * and the ranking can put the collision below the English hits.
 */
export type PinyinHit = "exact" | "syllable" | "partial";

export function pinyinRank(query: string, pinyin: string): PinyinHit | null {
  const q = query.trim();
  if (!q) return null;
  const hasTone = /[0-5]$|[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(q);
  const key = hasTone ? numeric : toneless;
  const wanted = key(q);
  // "?" and friends normalize to nothing, and every string starts with "" —
  // without this a punctuation-only query silently matches the whole corpus.
  if (!wanted) return null;
  const whole = key(pinyin);
  if (whole === wanted) return "exact";
  if (!whole.startsWith(wanted)) return null;
  let acc = "";
  for (const syllable of pinyin.split(/[\s'·]+/).filter(Boolean)) {
    acc += key(syllable);
    if (acc === wanted) return "syllable";
    if (acc.length > wanted.length) break;
  }
  return "partial";
}

/**
 * Does `query` match `pinyin`? Tone-insensitive unless the query specifies
 * tones, in which case they must agree — so "hao" finds 好/号, "hao3" only 好.
 */
export const pinyinMatches = (query: string, pinyin: string): boolean =>
  pinyinRank(query, pinyin) !== null;
