import type { Level } from "./types";

/**
 * Client-safe level helpers, used by both the shell and the data loaders.
 */
export const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7];

const isLevel = (n: number): n is Level => Number.isInteger(n) && n >= 1 && n <= 7;

/**
 * Levels live in the path as a comma list — `/hsk/1`, `/hsk/2`, `/hsk/1,2` — so
 * a multi-level selection stays bookmarkable and back-button correct.
 */
export function parseLevels(raw: string | undefined): Level[] {
  // Strict: every segment must be a real level and appear once. Sloppy variants
  // like "1," or "2,1" would mint extra URLs for a page that already has one.
  const parts = (raw ?? "").split(",");
  const levels = parts.map((p) => (/^[0-9]+$/.test(p) ? Number(p) : NaN));
  const ok =
    levels.length > 0 &&
    levels.every(isLevel) &&
    new Set(levels).size === levels.length &&
    levels.every((l, i) => i === 0 || l > levels[i - 1]!);
  if (!ok) throw new Response(`No such HSK level: ${raw}`, { status: 404 });
  return levels as Level[];
}

/** Inverse of `parseLevels`, for building links. */
export const formatLevels = (levels: Level[]): string =>
  [...levels].sort((a, b) => a - b).join(",");

/**
 * Toggle one level on or off, never returning an empty selection — unchecking
 * the last remaining level would leave nothing to show, so it is ignored.
 */
export function toggleLevel(current: Level[], level: Level): Level[] {
  const next = current.includes(level) ? current.filter((l) => l !== level) : [...current, level];
  return next.length === 0 ? current : next.sort((a, b) => a - b);
}

/** Display name. The wordlist merges 7, 8 and 9 into one band. */
export const levelLabel = (l: Level): string => (l === 7 ? "7–9" : String(l));
