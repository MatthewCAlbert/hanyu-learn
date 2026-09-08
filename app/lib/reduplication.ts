import { toneless } from "./pinyin";

export type RedupKind = "aabb" | "abab" | "aa";

export const DOUBLED_LABEL = "doubled";
export const DOUBLED_TITLE = "Looks like a doubled form of this word.";

/**
 * If `q` looks like a doubled Hanzi form, the undoubled base and which pattern
 * it used. AABB and ABAB need two distinct characters; AA is a single one.
 */
export function hanziRedup(q: string): { base: string; kind: RedupKind } | null {
  const chars = [...q];
  if (chars.length === 2 && chars[0] && chars[0] === chars[1]) {
    return { base: chars[0], kind: "aa" };
  }
  if (chars.length !== 4) return null;
  const [a, b, c, d] = chars;
  if (!a || !b || !c || !d) return null;
  if (a === b && c === d && a !== c) return { base: a + c, kind: "aabb" };
  if (a === c && b === d && a !== b) return { base: a + b, kind: "abab" };
  return null;
}

/** AABB of a two-syllable reading: `mǎ hu` → `mamahuhu`. */
export function aabbPinyin(pinyin: string): string | null {
  const syllables = pinyin
    .split(/[\s'·]+/)
    .filter(Boolean)
    .map((s) => toneless(s))
    .filter(Boolean);
  if (syllables.length !== 2) return null;
  const [a, b] = syllables;
  if (!a || !b || a === b) return null;
  return a + a + b + b;
}

/** AA of a one-syllable reading: `kàn` → `kankan`. */
export function aaPinyin(pinyin: string): string | null {
  const syllables = pinyin
    .split(/[\s'·]+/)
    .filter(Boolean)
    .map((s) => toneless(s))
    .filter(Boolean);
  if (syllables.length !== 1 || !syllables[0]) return null;
  return syllables[0] + syllables[0];
}

/** Which doubled-pinyin pattern, if any, makes `pinyin` equal `query`. */
export function pinyinRedup(query: string, pinyin: string): RedupKind | null {
  const wanted = toneless(query);
  if (!wanted) return null;
  if (aabbPinyin(pinyin) === wanted) return "aabb";
  if (aaPinyin(pinyin) === wanted) return "aa";
  return null;
}
