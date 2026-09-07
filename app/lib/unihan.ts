/**
 * Parse authored Unihan kRSUnicode citations. The apostrophe that marks a
 * simplified radical form is accepted and ignored: the vendored index stores
 * only { radical, extra }.
 */
const UNIHAN_KRS = /Unihan kRSUnicode:\s*(\d+)'?\.(-?\d+)/i;

export function parseUnihanKRSUnicode(source: string): { radical: number; extra: number } | null {
  const m = UNIHAN_KRS.exec(source);
  if (!m) return null;
  return { radical: Number(m[1]), extra: Number(m[2]) };
}

/** Error if an authored Unihan citation disagrees with the vendored index. */
export function kRSUnicodeCitationError(
  source: string,
  char: string,
  index: Record<string, { radical: number; extra: number } | undefined>,
): string | null {
  const cited = parseUnihanKRSUnicode(source);
  if (!cited) return null;
  const actual = index[char];
  if (!actual) return `Unihan kRSUnicode cited but ${char} is missing from radical-index.json`;
  if (cited.radical !== actual.radical || cited.extra !== actual.extra) {
    return `Unihan kRSUnicode cited ${cited.radical}.${cited.extra} but the index has ${actual.radical}.${actual.extra}`;
  }
  return null;
}
