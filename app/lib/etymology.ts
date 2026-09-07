import type { Etymology } from "./types";

type HanziLike = {
  authored?: { phonetic: string | null; semantic: string | null } | null;
  etymology?: Pick<
    Etymology,
    "phonetic" | "phoneticVisible" | "semantic" | "semanticVisible"
  > | null;
};

/**
 * The phonetic actually visible in the simplified character. Authored values
 * are already required to be in the glyph; upstream values marked lost in
 * simplification are dropped.
 */
export function effectivePhonetic(h: HanziLike): string | null {
  if (h.authored?.phonetic) return h.authored.phonetic;
  const p = h.etymology?.phonetic;
  if (!p || h.etymology?.phoneticVisible === false) return null;
  return p;
}

/** Same rule as {@link effectivePhonetic}, for the meaning-bearing component. */
export function effectiveSemantic(h: HanziLike): string | null {
  if (h.authored?.semantic) return h.authored.semantic;
  const s = h.etymology?.semantic;
  if (!s || h.etymology?.semanticVisible === false) return null;
  return s;
}
