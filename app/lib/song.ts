import { z } from "zod";
import type { Citation } from "~/lib/ai/types";
import { analyzeText, sourceBlocks, type Lexicon, type TextAnalysis, type TextBlock } from "~/lib/segment";
import { capText, containsHanzi } from "~/lib/translate";

export const SONG_QUERY_MAX = 200;
export const SONG_LYRIC_MAX = 12_000;
export const SONG_TITLE_MAX = 120;
export const SONG_ARTIST_MAX = 120;
export const SONG_CANDIDATE_MAX = 3;
export const SONG_LINE_MAX = 400;
export const SONG_SECTION_MAX = 40;
export const SONG_LINES_PER_SECTION_MAX = 80;
export const SONG_URL_MAX = 2_000;

export const SONG_SECTION_KINDS = [
  "verse",
  "chorus",
  "bridge",
  "intro",
  "outro",
  "other",
] as const;

export type SongSectionKind = (typeof SONG_SECTION_KINDS)[number];

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    return Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isYouTubeVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id);
}

export function parseYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = path.replace(/^\//, "").split("/")[0] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && VIDEO_ID_RE.test(fromQuery)) return fromQuery;

  const parts = path.split("/").filter(Boolean);
  const kind = parts[0];
  const maybeId = parts[1]?.split("&")[0] ?? "";
  if (kind && ["embed", "shorts", "live", "v"].includes(kind) && VIDEO_ID_RE.test(maybeId)) {
    return maybeId;
  }
  return null;
}

/** Privacy-enhanced embed URL. Never pass a model-provided URL as iframe.src. */
export function youtubePrivacyEmbedUrl(id: string): string {
  if (!VIDEO_ID_RE.test(id)) throw new Error("Invalid YouTube video id");
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function youtubeWatchUrl(id: string): string {
  if (!VIDEO_ID_RE.test(id)) throw new Error("Invalid YouTube video id");
  return `https://www.youtube.com/watch?v=${id}`;
}

function blankToUndef(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const songCandidateSchema = z.object({
  title: z.string().trim().min(1).max(SONG_TITLE_MAX),
  titlePinyin: z.string().trim().min(1).max(SONG_TITLE_MAX * 2),
  artist: z.string().trim().min(1).max(SONG_ARTIST_MAX),
  album: z.string().trim().max(SONG_TITLE_MAX).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  youtubeUrl: z.string().max(SONG_URL_MAX).optional(),
  reason: z.string().trim().max(400).optional(),
});

export const submitSongCandidatesInput = z.object({
  query: z.string().trim().max(SONG_QUERY_MAX).optional(),
  candidates: z.array(songCandidateSchema).max(SONG_CANDIDATE_MAX),
});

export type SongCandidate = z.infer<typeof songCandidateSchema>;
export type SubmitSongCandidatesInput = z.infer<typeof submitSongCandidatesInput>;

export const songLineSchema = z.object({
  chinese: z.string().trim().min(1).max(SONG_LINE_MAX),
  translation: z.string().trim().min(1).max(SONG_LINE_MAX * 2),
});

export const songSectionSchema = z.object({
  kind: z.enum(SONG_SECTION_KINDS),
  label: z.string().trim().max(80).optional(),
  lines: z.array(songLineSchema).max(SONG_LINES_PER_SECTION_MAX),
});

export const submitSongImportInput = z.object({
  title: z.string().trim().min(1).max(SONG_TITLE_MAX),
  artist: z.string().trim().min(1).max(SONG_ARTIST_MAX),
  album: z.string().trim().max(SONG_TITLE_MAX).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  lyricsSourceUrl: z
    .string()
    .trim()
    .min(1)
    .max(SONG_URL_MAX)
    .refine(isHttpUrl, "Lyrics source must be an http(s) URL"),
  youtubeUrl: z.string().max(SONG_URL_MAX).optional(),
  complete: z.boolean(),
  warning: z.string().trim().max(500).optional(),
  sections: z.array(songSectionSchema).max(SONG_SECTION_MAX),
});

export type SongLine = z.infer<typeof songLineSchema>;
export type SongSection = z.infer<typeof songSectionSchema>;
export type SubmitSongImportInput = z.infer<typeof submitSongImportInput>;

export interface SongSectionHeading {
  blockId: string;
  label: string;
  targetId: string;
}

export interface SongParagraph {
  id: string;
  translation: string;
  notes: { spanId?: string; text: string }[];
  block: TextBlock;
}

export interface BoundSongLine {
  id: string;
  chinese: string;
  translation: string;
  block: TextBlock;
}

export interface BoundSongSection {
  kind: SongSectionKind;
  label: string;
  startBlockId: string;
  lines: BoundSongLine[];
}

export interface BoundSong {
  title: string;
  titleAnalysis: TextAnalysis;
  artist: string;
  album?: string;
  year?: number;
  lyricsSourceUrl: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  complete: boolean;
  warning?: string;
  unavailable: boolean;
  sections: BoundSongSection[];
  headings: SongSectionHeading[];
  paragraphs: SongParagraph[];
  analysis: TextAnalysis;
  sourceText: string;
  citations: Citation[];
}

export type SongBindResult = { ok: true; song: BoundSong } | { ok: false; error: string };

export interface SavedSongRecord {
  v: 1;
  id: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  lyricsSourceUrl: string;
  youtubeVideoId?: string;
  complete: boolean;
  warning?: string;
  sections: SongSection[];
  citations: Citation[];
  createdAt: number;
  updatedAt: number;
}

export function songsHref(): string {
  return "/songs";
}

export function songHref(id: string): string {
  return `/songs/${encodeURIComponent(id)}`;
}

export function songSearchHref(q: string): string {
  const trimmed = q.trim();
  if (!trimmed) return "/songs";
  const seeded = trimmed.length > SONG_QUERY_MAX ? trimmed.slice(0, SONG_QUERY_MAX) : trimmed;
  return `/songs?${new URLSearchParams({ q: seeded })}`;
}

export function readSongQuery(params: URLSearchParams): string {
  const q = params.get("q")?.trim() ?? "";
  return q.length > SONG_QUERY_MAX ? q.slice(0, SONG_QUERY_MAX) : q;
}

export function sectionLabel(section: { kind: SongSectionKind; label?: string }): string {
  if (section.label?.trim()) return section.label.trim();
  return section.kind.charAt(0).toUpperCase() + section.kind.slice(1);
}

/** Stable in-page target for a lyric section, derived from its first block id. */
export function songSectionTargetId(blockId: string): string {
  return `lyric-${blockId}`;
}

/** Number only when a label repeats: Chorus, Chorus -> Chorus 1, Chorus 2. */
export function numberedSectionLabels(labels: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return labels.map((label) => {
    if ((counts.get(label) ?? 0) < 2) return label;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return `${label} ${n}`;
  });
}

export function lyricSectionNav(
  headings: readonly SongSectionHeading[],
): { label: string; targetId: string }[] {
  const numbered = numberedSectionLabels(headings.map((heading) => heading.label));
  return headings.map((heading, i) => ({
    label: numbered[i] ?? heading.label,
    targetId: heading.targetId || songSectionTargetId(heading.blockId),
  }));
}

export function flattenSongSource(sections: SongSection[]): string {
  const lines: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;
    if (i > 0) lines.push("");
    for (const line of section.lines) {
      lines.push(line.chinese.trim().replace(/\s+/g, " "));
    }
  }
  return lines.join("\n");
}

function flattenForBind(sections: SongSection[]): {
  sourceText: string;
  entries: { chinese: string; translation: string; sectionIndex: number }[];
} {
  const lines: string[] = [];
  const entries: { chinese: string; translation: string; sectionIndex: number }[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;
    if (i > 0) lines.push("");
    for (const line of section.lines) {
      const chinese = line.chinese.trim().replace(/\s+/g, " ");
      const translation = line.translation.trim();
      lines.push(chinese);
      entries.push({ chinese, translation, sectionIndex: i });
    }
  }
  return { sourceText: lines.join("\n"), entries };
}

export function mergeSongCitations(citations: Citation[], lyricsSourceUrl: string): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  const add = (url: string, title?: string) => {
    if (!isHttpUrl(url) || seen.has(url)) return;
    seen.add(url);
    out.push({ url, title });
  };
  add(lyricsSourceUrl, "Lyrics source");
  for (const citation of citations) add(citation.url, citation.title);
  return out;
}

function youtubeFields(raw?: string): { youtubeUrl?: string; youtubeVideoId?: string } {
  const youtubeUrl = raw?.trim() || undefined;
  if (!youtubeUrl) return {};
  const youtubeVideoId = parseYouTubeVideoId(youtubeUrl) ?? undefined;
  return { youtubeUrl, youtubeVideoId };
}

export function bindSongImport(
  payload: SubmitSongImportInput,
  lexicon: Lexicon,
  citations: Citation[] = [],
): SongBindResult {
  const parsed = submitSongImportInput.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid song import" };
  }
  const data = parsed.data;
  const warning = blankToUndef(data.warning);
  const album = blankToUndef(data.album);
  const youtubeUrl = blankToUndef(data.youtubeUrl);
  const lineCount = data.sections.reduce((n, section) => n + section.lines.length, 0);
  if (data.complete && lineCount === 0) {
    return { ok: false, error: "Complete imports must include lyric lines" };
  }
  if (lineCount === 0) {
    if (!warning) {
      return { ok: false, error: "Unavailable lyrics need a warning explaining why" };
    }
    return {
      ok: true,
      song: emptyBoundSong({ ...data, album, warning, youtubeUrl }, citations, lexicon),
    };
  }

  const { sourceText, entries } = flattenForBind(data.sections);
  if (!entries.some((line) => containsHanzi(line.chinese))) {
    return { ok: false, error: "Imported lyrics must include Chinese characters" };
  }

  const analysis = analyzeText(sourceText, lexicon, SONG_LYRIC_MAX);
  const needed = sourceBlocks(analysis);
  if (needed.length !== entries.length && !analysis.truncated) {
    return { ok: false, error: "Lyric lines did not match the segmented source" };
  }
  const count = Math.min(needed.length, entries.length);
  const boundSections: BoundSongSection[] = data.sections.map((section) => ({
    kind: section.kind,
    label: sectionLabel(section),
    startBlockId: "",
    lines: [],
  }));
  const paragraphs: SongParagraph[] = [];
  const headings: SongSectionHeading[] = [];

  for (let i = 0; i < count; i++) {
    const block = needed[i];
    const entry = entries[i];
    if (!block || !entry) continue;
    const section = boundSections[entry.sectionIndex];
    if (!section) continue;
    if (!section.startBlockId) {
      section.startBlockId = block.id;
      headings.push({
        blockId: block.id,
        label: section.label,
        targetId: songSectionTargetId(block.id),
      });
    }
    const line: BoundSongLine = {
      id: block.id,
      chinese: entry.chinese,
      translation: entry.translation,
      block,
    };
    section.lines.push(line);
    paragraphs.push({ id: block.id, translation: entry.translation, notes: [], block });
  }

  const kept = boundSections.filter((section) => section.lines.length > 0);
  const youtube = youtubeFields(youtubeUrl);
  return {
    ok: true,
    song: {
      title: data.title,
      titleAnalysis: analyzeText(data.title, lexicon, SONG_TITLE_MAX),
      artist: data.artist,
      album,
      year: data.year,
      lyricsSourceUrl: data.lyricsSourceUrl,
      ...youtube,
      complete: data.complete && !analysis.truncated,
      warning: analysis.truncated
        ? [warning, `Lyrics were capped at ${SONG_LYRIC_MAX.toLocaleString()} characters.`]
            .filter(Boolean)
            .join(" ")
        : warning,
      unavailable: false,
      sections: kept,
      headings,
      paragraphs,
      analysis,
      sourceText: analysis.truncated ? capText(sourceText, SONG_LYRIC_MAX).text : sourceText,
      citations: mergeSongCitations(citations, data.lyricsSourceUrl),
    },
  };
}

function emptyBoundSong(
  data: SubmitSongImportInput,
  citations: Citation[],
  lexicon: Lexicon,
): BoundSong {
  const youtube = youtubeFields(blankToUndef(data.youtubeUrl));
  return {
    title: data.title,
    titleAnalysis: analyzeText(data.title, lexicon, SONG_TITLE_MAX),
    artist: data.artist,
    album: blankToUndef(data.album),
    year: data.year,
    lyricsSourceUrl: data.lyricsSourceUrl,
    ...youtube,
    complete: false,
    warning: blankToUndef(data.warning),
    unavailable: true,
    sections: [],
    headings: [],
    paragraphs: [],
    analysis: { blocks: [], truncated: false },
    sourceText: "",
    citations: mergeSongCitations(citations, data.lyricsSourceUrl),
  };
}

export function toSavedSongRecord(
  song: BoundSong,
  id: string,
  timestamps: { createdAt: number; updatedAt: number },
): SavedSongRecord {
  return {
    v: 1,
    id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    year: song.year,
    lyricsSourceUrl: song.lyricsSourceUrl,
    youtubeVideoId: song.youtubeVideoId,
    complete: song.complete,
    warning: song.warning,
    sections: song.sections.map((section) => ({
      kind: section.kind,
      label: section.label,
      lines: section.lines.map((line) => ({
        chinese: line.chinese,
        translation: line.translation,
      })),
    })),
    citations: song.citations,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

export function hydrateSavedSong(record: SavedSongRecord, lexicon: Lexicon): SongBindResult {
  if (record.v !== 1) return { ok: false, error: "Unsupported saved song version" };
  const youtubeUrl = record.youtubeVideoId ? youtubeWatchUrl(record.youtubeVideoId) : undefined;
  return bindSongImport(
    {
      title: record.title,
      artist: record.artist,
      album: record.album,
      year: record.year,
      lyricsSourceUrl: record.lyricsSourceUrl,
      youtubeUrl,
      complete: record.complete,
      warning: record.warning,
      sections: record.sections,
    },
    lexicon,
    record.citations,
  );
}

export function withYouTubeCandidate(song: BoundSong, rawUrl: string): BoundSong {
  const youtube = youtubeFields(rawUrl);
  return { ...song, youtubeUrl: youtube.youtubeUrl, youtubeVideoId: youtube.youtubeVideoId };
}

export function newSongId(): string {
  return crypto.randomUUID();
}
