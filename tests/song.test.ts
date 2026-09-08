import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractSongCandidatesPayload,
  extractSongImportPayload,
  failSong,
  isProviderRateLimitError,
  parseSubmitSongCandidates,
  parseSubmitSongImport,
  songRetryDelayMs,
  waitForSongRetry,
} from "~/lib/ai/song";
import { SONG_WEB_SEARCH_PARAMS, WEB_SEARCH_PARAMS } from "~/lib/ai/tools";
import { serializeSongContext } from "~/lib/ai/context";
import { suggestionsFor } from "~/lib/ai/suggestions";
import { buildLexicon } from "~/lib/segment";
import {
  bindSongImport,
  hydrateSavedSong,
  isHttpUrl,
  lyricSectionNav,
  numberedSectionLabels,
  parseYouTubeVideoId,
  songHref,
  songSearchHref,
  songSectionTargetId,
  submitSongCandidatesInput,
  submitSongImportInput,
  toSavedSongRecord,
  youtubePrivacyEmbedUrl,
  youtubeWatchUrl,
  type SubmitSongImportInput,
} from "~/lib/song";
import {
  deleteSavedSong,
  getSavedSong,
  listSavedSongs,
  putSavedSong,
  resetSongDbForTests,
} from "~/lib/song-db.client";

const lexicon = buildLexicon({
  hanzi: [
    { char: "我", pinyin: ["wǒ"], meanings: ["I"], level: 1 },
    { char: "好", pinyin: ["hǎo"], meanings: ["good"], level: 1 },
    { char: "你", pinyin: ["nǐ"], meanings: ["you"], level: 1 },
    { char: "爱", pinyin: ["ài"], meanings: ["love"], level: 1 },
  ],
  words: [
    { word: "你好", pinyin: "nǐhǎo", meanings: ["hello"], level: 1, extra: false },
    { word: "我", pinyin: "wǒ", meanings: ["I"], level: 1, extra: false },
  ],
});

function importPayload(overrides: Partial<SubmitSongImportInput> = {}): SubmitSongImportInput {
  return {
    title: "小幸运",
    artist: "田馥甄",
    lyricsSourceUrl: "https://example.com/lyrics/xiaoxingyun",
    complete: true,
    sections: [
      {
        kind: "verse",
        lines: [{ chinese: "我好想你", translation: "I miss you so much" }],
      },
      {
        kind: "chorus",
        lines: [{ chinese: "你好", translation: "Hello" }],
      },
      {
        kind: "chorus",
        lines: [{ chinese: "你好", translation: "Hello" }],
      },
    ],
    ...overrides,
  };
}

describe("song URLs", () => {
  it("seeds a bookmarkable search and saved-song path", () => {
    expect(songSearchHref("")).toBe("/songs");
    expect(songSearchHref("  小幸运  ")).toBe(`/songs?${new URLSearchParams({ q: "小幸运" })}`);
    expect(songHref("abc")).toBe("/songs/abc");
  });
});

describe("YouTube allowlisting", () => {
  it("extracts ids from watch, share, Shorts, and embed URLs", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-YouTube and unsafe URLs", () => {
    expect(parseYouTubeVideoId("https://vimeo.com/123")).toBeNull();
    expect(parseYouTubeVideoId("javascript:alert(1)")).toBeNull();
    expect(parseYouTubeVideoId("https://www.youtube.com/playlist?list=PLtest")).toBeNull();
    expect(parseYouTubeVideoId("https://www.youtube.com/redirect?q=https://evil.test")).toBeNull();
    expect(parseYouTubeVideoId("https://evil.example/embed/dQw4w9WgXcQ")).toBeNull();
  });

  it("builds a privacy embed internally and never uses the source URL", () => {
    const source = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1";
    const id = parseYouTubeVideoId(source);
    expect(id).toBe("dQw4w9WgXcQ");
    expect(youtubePrivacyEmbedUrl(id!)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubePrivacyEmbedUrl(id!)).not.toContain("autoplay");
    expect(youtubeWatchUrl(id!)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

describe("candidate and import schemas", () => {
  it("accepts up to three evidence-backed matches", () => {
    const parsed = submitSongCandidatesInput.parse({
      candidates: [
        {
          title: "小幸运",
          titlePinyin: "xiǎo xìng yùn",
          artist: "田馥甄",
          youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
        },
        { title: "小幸运", titlePinyin: "xiǎo xìng yùn", artist: "其他", reason: "cover" },
      ],
    });
    expect(parsed.candidates).toHaveLength(2);
  });

  it("rejects a fourth candidate and empty titles", () => {
    expect(
      submitSongCandidatesInput.safeParse({
        candidates: [
          { title: "A", titlePinyin: "a", artist: "1" },
          { title: "B", titlePinyin: "b", artist: "2" },
          { title: "C", titlePinyin: "c", artist: "3" },
          { title: "D", titlePinyin: "d", artist: "4" },
        ],
      }).success,
    ).toBe(false);
    expect(
      submitSongCandidatesInput.safeParse({
        candidates: [{ title: "", titlePinyin: "x", artist: "x" }],
      }).success,
    ).toBe(false);
  });

  it("requires a cited http(s) lyrics source", () => {
    expect(isHttpUrl("https://example.com/lyrics")).toBe(true);
    expect(submitSongImportInput.safeParse(importPayload()).success).toBe(true);
    expect(
      submitSongImportInput.safeParse(importPayload({ lyricsSourceUrl: "javascript:alert(1)" })).success,
    ).toBe(false);
    expect(
      submitSongImportInput.safeParse(importPayload({ lyricsSourceUrl: "not-a-url" })).success,
    ).toBe(false);
  });

  it("rejects complete imports with no lines", () => {
    expect(
      submitSongImportInput.safeParse(importPayload({ complete: true, sections: [] })).success,
    ).toBe(true);
    const bound = bindSongImport(importPayload({ complete: true, sections: [] }), lexicon);
    expect(bound.ok).toBe(false);
  });
});

describe("malformed AI payloads", () => {
  it("returns null for candidate payloads that are not songs", () => {
    expect(parseSubmitSongCandidates({ foo: 1 })).toBeNull();
    expect(parseSubmitSongCandidates("not json")).toBeNull();
    expect(parseSubmitSongImport({ paragraphs: [] })).toBeNull();
  });

  it("unwraps nested submit tools", () => {
    expect(
      parseSubmitSongCandidates({
        output: {
          candidates: [{ title: "小幸运", titlePinyin: "xiǎo xìng yùn", artist: "田馥甄" }],
        },
      })?.candidates[0]?.title,
    ).toBe("小幸运");
    expect(
      extractSongCandidatesPayload([
        { name: "web_search", args: {} },
        {
          name: "submit_song_candidates",
          args: {
            candidates: [
              { title: "小幸运", titlePinyin: "xiǎo xìng yùn", artist: "田馥甄" },
            ],
          },
        },
      ])?.candidates,
    ).toHaveLength(1);
    expect(
      extractSongImportPayload([
        { name: "submit_song_import", args: importPayload() },
      ])?.title,
    ).toBe("小幸运");
  });
});

describe("lyric binding", () => {
  it("preserves ordered sections, repeated choruses, and corpus tokens", () => {
    const bound = bindSongImport(importPayload({ title: "你好" }), lexicon);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.song.sections.map((s) => s.kind)).toEqual(["verse", "chorus", "chorus"]);
    expect(bound.song.paragraphs.map((p) => p.id)).toEqual(["p0", "p2", "p4"]);
    expect(bound.song.headings.map((h) => h.label)).toEqual(["Verse", "Chorus", "Chorus"]);
    expect(bound.song.headings.map((h) => h.targetId)).toEqual(["lyric-p0", "lyric-p2", "lyric-p4"]);
    expect(bound.song.headings.map((h) => h.targetId)).toEqual(
      bound.song.headings.map((h) => songSectionTargetId(h.blockId)),
    );
    expect(lyricSectionNav(bound.song.headings).map((item) => item.label)).toEqual([
      "Verse",
      "Chorus 1",
      "Chorus 2",
    ]);
    expect(bound.song.paragraphs[1]?.translation).toBe("Hello");
    expect(bound.song.paragraphs[2]?.translation).toBe("Hello");
    const hello = bound.song.analysis.blocks.find((b) => b.id === "p2");
    expect(hello?.spans.some((s) => s.ref?.id === "你好")).toBe(true);
    expect(bound.song.citations[0]?.url).toBe("https://example.com/lyrics/xiaoxingyun");
    expect(bound.song.titleAnalysis.blocks[0]?.spans.some((span) => span.ref)).toBe(true);
  });

  it("numbers only repeated section labels", () => {
    expect(numberedSectionLabels(["Verse", "Chorus", "Bridge"])).toEqual([
      "Verse",
      "Chorus",
      "Bridge",
    ]);
    expect(numberedSectionLabels(["Chorus", "Verse", "Chorus"])).toEqual([
      "Chorus 1",
      "Verse",
      "Chorus 2",
    ]);
    expect(songSectionTargetId("p4")).toBe("lyric-p4");
  });

  it("surfaces unavailable lyrics instead of inventing text", () => {
    const bound = bindSongImport(
      importPayload({ complete: false, warning: "Paywalled source", sections: [] }),
      lexicon,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.song.unavailable).toBe(true);
    expect(bound.song.sourceText).toBe("");
    expect(bound.song.warning).toBe("Paywalled source");
  });

  it("rejects unavailable lyrics without a warning", () => {
    const bound = bindSongImport(importPayload({ complete: false, sections: [] }), lexicon);
    expect(bound.ok).toBe(false);
  });

  it("maps a YouTube candidate when the URL is allowed", () => {
    const bound = bindSongImport(
      importPayload({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }),
      lexicon,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.song.youtubeVideoId).toBe("dQw4w9WgXcQ");
  });
});

describe("song errors and search budget", () => {
  it("normalizes stop vs other failures", () => {
    expect(failSong(new DOMException("aborted", "AbortError"))).toEqual({
      reason: "stopped",
      message: "Stopped.",
    });
    expect(failSong(new Error("401 Unauthorized")).reason).toBe("error");
  });

  it("detects nested provider 429 responses for backoff retry", () => {
    expect(
      isProviderRateLimitError({
        message: "Provider returned error",
        code: 429,
        metadata: { provider_name: null },
      }),
    ).toBe(true);
    expect(
      isProviderRateLimitError(
        Object.assign(new Error("Provider returned error"), {
          cause: { response: { status: 429 } },
        }),
      ),
    ).toBe(true);
    expect(isProviderRateLimitError(new Error("401 Unauthorized"))).toBe(false);
  });

  it("uses capped exponential jitter and lets Stop cancel backoff", async () => {
    expect(songRetryDelayMs(0, () => 0.5)).toBe(750);
    expect(songRetryDelayMs(1, () => 0.5)).toBe(1_500);
    expect(songRetryDelayMs(20, () => 0.5)).toBe(3_000);
    const controller = new AbortController();
    controller.abort();
    await expect(waitForSongRetry(10_000, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("gives song search a deeper budget without changing study-chat defaults", () => {
    expect(WEB_SEARCH_PARAMS).toEqual({
      engine: "auto",
      maxResults: 5,
      maxTotalResults: 8,
      searchContextSize: "low",
    });
    expect(SONG_WEB_SEARCH_PARAMS).toEqual({
      engine: "auto",
      maxResults: 8,
      maxTotalResults: 12,
      searchContextSize: "medium",
    });
  });
});

describe("song page context", () => {
  it("snapshots lyrics for study chat", () => {
    const bound = bindSongImport(importPayload(), lexicon);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    const ctx = serializeSongContext(bound.song, "/songs");
    expect(ctx.kind).toBe("song");
    expect(ctx.text).toContain("小幸运");
    expect(ctx.text).toContain("Corpus spans:");
    expect(suggestionsFor(ctx).map((c) => c.id)).toEqual(["explain"]);
  });
});

describe("IndexedDB song library", () => {
  beforeEach(() => {
    resetSongDbForTests();
  });

  afterEach(() => {
    resetSongDbForTests();
    indexedDB.deleteDatabase("hanyu-songs");
  });

  it("saves, updates, rehydrates, and deletes only after an explicit put", async () => {
    expect(await listSavedSongs()).toEqual([]);
    const bound = bindSongImport(importPayload({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }), lexicon);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    const record = toSavedSongRecord(bound.song, "song-1", { createdAt: 1, updatedAt: 2 });
    await putSavedSong(record);
    expect((await listSavedSongs()).map((s) => s.id)).toEqual(["song-1"]);
    const loaded = await getSavedSong("song-1");
    expect(loaded?.youtubeVideoId).toBe("dQw4w9WgXcQ");
    expect(loaded?.sections).toHaveLength(3);

    await putSavedSong({ ...record, title: "Updated", updatedAt: 3 });
    expect((await getSavedSong("song-1"))?.title).toBe("Updated");

    const hydrated = hydrateSavedSong((await getSavedSong("song-1"))!, lexicon);
    expect(hydrated.ok).toBe(true);
    if (!hydrated.ok) return;
    expect(hydrated.song.paragraphs).toHaveLength(3);
    expect(hydrated.song.youtubeVideoId).toBe("dQw4w9WgXcQ");

    await deleteSavedSong("song-1");
    expect(await listSavedSongs()).toEqual([]);
    expect(await getSavedSong("song-1")).toBeNull();
  });
});
