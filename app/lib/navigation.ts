import {
  bandsSummary,
  defaultBrowsePath,
  parseBands,
  type Bands,
  type BrowseTab,
} from "./levels";
import { readFilters } from "./filters";

export type BrowseOrigin = {
  /** Validated in-app browse URL, including search. */
  from: string;
};

const BROWSE_PATH = /^\/hsk\/([^/]+)\/(hanzi|words|topics|radicals|phonetics)$/;

const TAB_LABEL: Record<BrowseTab, string> = {
  hanzi: "Hanzi",
  words: "Words",
  topics: "Topics",
  radicals: "Radicals",
  phonetics: "Phonetics",
};

export interface ParsedBrowseHref {
  pathname: string;
  search: string;
  bands: Bands;
  tab: BrowseTab;
}

/**
 * Accept only same-app `/hsk/:bands/:tab` URLs. Rejects open redirects,
 * javascript: URLs, and detail/settings paths.
 */
export function parseBrowseHref(href: string): ParsedBrowseHref | null {
  if (!href.startsWith("/hsk/")) return null;
  let pathname: string;
  let search = "";
  try {
    const url = new URL(href, "https://hanyu.invalid");
    if (url.origin !== "https://hanyu.invalid") return null;
    if (url.username || url.password || url.hash) return null;
    pathname = url.pathname;
    search = url.search;
  } catch {
    return null;
  }
  const match = BROWSE_PATH.exec(pathname);
  if (!match) return null;
  try {
    const bands = parseBands(match[1]);
    return { pathname, search, bands, tab: match[2] as BrowseTab };
  } catch {
    return null;
  }
}

export function browseHrefFromLocation(location: { pathname: string; search: string }): string | null {
  const parsed = parseBrowseHref(`${location.pathname}${location.search}`);
  if (!parsed) return null;
  return `${parsed.pathname}${parsed.search}`;
}

export function browseOriginFromLocation(location: {
  pathname: string;
  search: string;
}): BrowseOrigin | undefined {
  const from = browseHrefFromLocation(location);
  return from ? { from } : undefined;
}

export function readBrowseOrigin(state: unknown): BrowseOrigin | undefined {
  if (!state || typeof state !== "object") return undefined;
  const from = (state as { from?: unknown }).from;
  if (typeof from !== "string") return undefined;
  const parsed = parseBrowseHref(from);
  if (!parsed) return undefined;
  return { from: `${parsed.pathname}${parsed.search}` };
}

export function browseLabel(href: string): string {
  const parsed = parseBrowseHref(href);
  if (!parsed) return "Browse";
  const filters = readFilters(
    new URLSearchParams(parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search),
  );
  const filtered = Boolean(
    filters.q ||
      filters.radicals.length ||
      filters.status.length ||
      filters.standards.length ||
      filters.topics.length,
  );
  const base = `${bandsSummary(parsed.bands)} · ${TAB_LABEL[parsed.tab]}`;
  return filtered ? `${base} (filtered)` : base;
}

export function resolveBrowseOrigin(
  state: unknown,
  fallback: { to: string; label: string },
): { to: string; label: string } {
  const origin = readBrowseOrigin(state);
  if (!origin) return fallback;
  return { to: origin.from, label: browseLabel(origin.from) };
}

export function defaultBrowseFallback(tab: BrowseTab = "hanzi"): { to: string; label: string } {
  const to = defaultBrowsePath(tab);
  return { to, label: browseLabel(to) };
}

/**
 * React Router tags the session's first location with key `"default"`.
 * Later client navigations get a random key, so Back can use history.
 */
export function canHistoryBack(locationKey: string): boolean {
  return locationKey !== "default";
}
