import type { Level } from "./types";

/**
 * Client-safe level helpers, used by both the shell and the data loaders.
 */
export const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7];

const isLevel = (n: number): n is Level => Number.isInteger(n) && n >= 1 && n <= 7;

export interface Bands {
  /** HSK 3.0 levels, ascending, unique. Empty when Extra is the only band. */
  levels: Level[];
  /** Supplement vocabulary that is not on the HSK 3.0 wordlist. */
  extra: boolean;
}

function notFound(raw: string | undefined): never {
  throw new Response(`No such HSK selection: ${raw}`, { status: 404 });
}

/**
 * Levels live in the path as a comma list — `/hsk/1`, `/hsk/2` or `/hsk/1,2` —
 * so a multi-level selection stays bookmarkable. Extra is an optional last
 * token: `/hsk/extra`, `/hsk/1,2,extra`.
 */
export function parseBands(raw: string | undefined): Bands {
  const parts = (raw ?? "").split(",");
  if (parts.length === 0 || parts.some((p) => p === "")) notFound(raw);

  let extra = false;
  let levelParts = parts;
  if (parts[parts.length - 1] === "extra") {
    extra = true;
    levelParts = parts.slice(0, -1);
  }
  if (levelParts.includes("extra")) notFound(raw);

  if (levelParts.length === 0) {
    if (!extra) notFound(raw);
    return { levels: [], extra: true };
  }

  const levels = levelParts.map((p) => (/^[0-9]+$/.test(p) ? Number(p) : NaN));
  const ok =
    levels.every(isLevel) &&
    new Set(levels).size === levels.length &&
    levels.every((l, i) => i === 0 || l > levels[i - 1]!);
  if (!ok) notFound(raw);
  return { levels: levels as Level[], extra };
}

/**
 * HSK-only parser. Rejects Extra so callers that cannot use it 404 on
 * `/hsk/extra` rather than silently dropping the token.
 */
export function parseLevels(raw: string | undefined): Level[] {
  const bands = parseBands(raw);
  if (bands.extra || bands.levels.length === 0) notFound(raw);
  return bands.levels;
}

/** Inverse of `parseLevels`, for building HSK-only links. */
export const formatLevels = (levels: Level[]): string =>
  [...levels].sort((a, b) => a - b).join(",");

/** Inverse of `parseBands`. Extra is always last. */
export function formatBands(bands: Bands): string {
  const levels = formatLevels(bands.levels);
  if (bands.extra) return levels ? `${levels},extra` : "extra";
  return levels;
}

/** Landing selection: every HSK band plus Extra. */
export const DEFAULT_BANDS: Bands = { levels: LEVELS, extra: true };

export const DEFAULT_BANDS_PATH = formatBands(DEFAULT_BANDS);

export type BrowseTab = "hanzi" | "words" | "topics" | "radicals" | "phonetics" | "grammar";

export function defaultBrowsePath(tab: BrowseTab = "hanzi"): string {
  return `/hsk/${DEFAULT_BANDS_PATH}/${tab}`;
}

export function isDefaultBands(bands: Bands): boolean {
  return bands.extra && bands.levels.length === LEVELS.length;
}

/** Compact label for the current selection, used on mobile and in titles. */
export function bandsSummary(bands: Bands): string {
  if (isDefaultBands(bands)) return "All levels + Extra";
  if (bands.levels.length === LEVELS.length) return "All levels";
  if (bands.levels.length === 0) return "Extra";
  const hsk = bands.levels.map(levelLabel).join(", ");
  return bands.extra ? `HSK ${hsk} + Extra` : `HSK ${hsk}`;
}

/**
 * Toggle one level on or off, never returning an empty selection — unchecking
 * the last remaining level would leave nothing to show, so it is ignored.
 */
export function toggleLevel(current: Level[], level: Level): Level[] {
  const next = current.includes(level) ? current.filter((l) => l !== level) : [...current, level];
  return next.length === 0 ? current : next.sort((a, b) => a - b);
}

/** Toggle an HSK level inside a band selection. Extra can keep the selection non-empty. */
export function toggleLevelInBands(current: Bands, level: Level): Bands {
  const on = current.levels.includes(level);
  if (on) {
    const next = current.levels.filter((l) => l !== level);
    if (next.length === 0 && !current.extra) return current;
    return { levels: next, extra: current.extra };
  }
  return { levels: [...current.levels, level].sort((a, b) => a - b), extra: current.extra };
}

/** Toggle Extra on or off, never leaving both Extra and every HSK level off. */
export function toggleExtra(current: Bands): Bands {
  const next = { levels: current.levels, extra: !current.extra };
  if (next.levels.length === 0 && !next.extra) return current;
  return next;
}

/** Display name. The wordlist merges 7, 8 and 9 into one band. */
export const levelLabel = (l: Level): string => (l === 7 ? "7–9" : String(l));
