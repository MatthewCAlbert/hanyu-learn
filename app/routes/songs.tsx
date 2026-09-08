import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router";
import type { Route } from "./+types/songs";
import { DetailShell } from "~/components/DetailShell";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { ToolActivityList, UsageDetails } from "~/components/ai/UsageDetails";
import { SavedSongList } from "~/components/songs/SavedSongList";
import { SongAiPanel, type SongAiStatus } from "~/components/songs/SongAiPanel";
import { SongCandidateList } from "~/components/songs/SongCandidateList";
import { SongSearchForm } from "~/components/songs/SongSearchForm";
import { SongStudy } from "~/components/songs/SongStudy";
import type { DetailMode, TokenSelection } from "~/components/translate/TranslateDocument";
import { serializeSongContext } from "~/lib/ai/context";
import { hasValidConfig } from "~/lib/ai/config";
import { useAiStore } from "~/lib/ai/store";
import { loadCompareCatalog } from "~/lib/detail-data";
import { defaultBrowseFallback } from "~/lib/navigation";
import { buildLexicon } from "~/lib/segment";
import { listSavedSongs, putSavedSong } from "~/lib/song-db.client";
import {
  newSongId,
  readSongQuery,
  songHref,
  toSavedSongRecord,
  withYouTubeCandidate,
  type BoundSong,
  type SavedSongRecord,
  type SongCandidate,
} from "~/lib/song";

type WorkspaceView = "import" | "saved";

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.q?.trim();
  if (!q) return [{ title: "Songs — Mandarin" }];
  const preview = q.length > 16 ? `${q.slice(0, 15)}…` : q;
  return [{ title: `${preview} — Songs` }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const [q, catalog] = await Promise.all([
    Promise.resolve(readSongQuery(url.searchParams)),
    loadCompareCatalog(),
  ]);
  return { q, catalog };
}
clientLoader.hydrate = true as const;

export default function SongsPage({ loaderData }: Route.ComponentProps) {
  const { q, catalog } = loaderData;
  const navigate = useNavigate();
  const config = useAiStore((s) => s.config);
  const [view, setView] = useState<WorkspaceView>("import");
  const [query, setQuery] = useState(q);
  const [committedQuery, setCommittedQuery] = useState("");
  const [ai, setAi] = useState<SongAiStatus>({ status: "idle" });
  const [candidates, setCandidates] = useState<SongCandidate[] | null>(null);
  const [song, setSong] = useState<BoundSong | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [mode, setMode] = useState<DetailMode>("embed");
  const [selected, setSelected] = useState<TokenSelection | null>(null);
  const [saved, setSaved] = useState<SavedSongRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(`song:${crypto.randomUUID()}`);

  const lexicon = useMemo(
    () => buildLexicon({ hanzi: catalog.hanzi, words: catalog.words }),
    [catalog],
  );

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    if (view !== "saved") return;
    void listSavedSongs().then(setSaved);
  }, [view]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const resetImport = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAi({ status: "idle" });
    setCandidates(null);
    setSong(null);
    setYoutubeUrl("");
    setLoadedVideoId(null);
    setSelected(null);
    setCommittedQuery("");
    sessionRef.current = `song:${crypto.randomUUID()}`;
  };

  const search = async () => {
    const next = query.trim();
    if (!next || !hasValidConfig(config)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCommittedQuery(next);
    setCandidates(null);
    setSong(null);
    setYoutubeUrl("");
    setLoadedVideoId(null);
    setSelected(null);
    setAi({ status: "running", phase: "search", tools: [] });
    sessionRef.current = `song-search:${crypto.randomUUID()}`;
    try {
      const { runSongCandidateAgent } = await import("~/lib/ai/song");
      const result = await runSongCandidateAgent({
        config,
        sessionId: sessionRef.current,
        query: next,
        signal: controller.signal,
        onTools: (tools) => setAi({ status: "running", phase: "search", tools }),
      });
      setCandidates(result.candidates);
      setAi({ status: "done", phase: "search", usage: result.usage, tools: result.tools });
    } catch (err) {
      const { failSong } = await import("~/lib/ai/song");
      const failed = failSong(err);
      if (failed.reason === "stopped") {
        setAi({ status: "idle" });
        return;
      }
      setAi({ status: "error", phase: "search", message: failed.message, tools: [] });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const importCandidate = async (candidate: SongCandidate) => {
    if (!hasValidConfig(config)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSong(null);
    setSelected(null);
    setAi({ status: "running", phase: "import", tools: [] });
    sessionRef.current = `song-import:${crypto.randomUUID()}`;
    try {
      const { runSongImportAgent } = await import("~/lib/ai/song");
      const result = await runSongImportAgent({
        config,
        sessionId: sessionRef.current,
        query: committedQuery || query.trim(),
        candidate,
        lexicon,
        signal: controller.signal,
        onTools: (tools) => setAi({ status: "running", phase: "import", tools }),
      });
      setSong(result.song);
      setYoutubeUrl(result.song.youtubeUrl ?? "");
      setLoadedVideoId(null);
      setAi({ status: "done", phase: "import", usage: result.usage, tools: result.tools });
    } catch (err) {
      const { failSong } = await import("~/lib/ai/song");
      const failed = failSong(err);
      if (failed.reason === "stopped") {
        setAi({ status: "idle" });
        return;
      }
      setAi({ status: "error", phase: "import", message: failed.message, tools: [] });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const saveLocally = async () => {
    if (!song) return;
    const now = Date.now();
    const id = newSongId();
    const next = withYouTubeCandidate(song, youtubeUrl);
    await putSavedSong(
      toSavedSongRecord(next, id, { createdAt: now, updatedAt: now }),
    );
    navigate(songHref(id));
  };

  const context = useMemo(
    () => (song ? serializeSongContext(withYouTubeCandidate(song, youtubeUrl), "/songs") : null),
    [song, youtubeUrl],
  );

  const showCandidates =
    view === "import" && !song && candidates !== null && ai.status !== "running";
  const importing = ai.status === "running" && ai.phase === "import";

  return (
    <>
      {context ? <PageContextBridge context={context} /> : null}
      <DetailShell current="Songs" fallback={defaultBrowseFallback("hanzi")}>
        <fieldset className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
          <legend className="sr-only">Songs workspace</legend>
          {(
            [
              ["import", "Import"],
              ["saved", "Saved"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                if (view === value) return;
                abortRef.current?.abort();
                abortRef.current = null;
                if (ai.status === "running") setAi({ status: "idle" });
                setView(value);
              }}
              className={clsx(
                "ui-touch min-w-20 rounded-lg px-3 text-sm font-medium",
                view === value ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>

        {view === "saved" ? (
          <div className="mt-6">
            <SavedSongList songs={saved} />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {!song && (
              <>
                <SongSearchForm
                  value={query}
                  onChange={setQuery}
                  onSubmit={() => void search()}
                  disabled={ai.status === "running"}
                />
                <SongAiPanel
                  state={ai}
                  disabled={!query.trim()}
                  onSearch={() => void search()}
                  onStop={() => abortRef.current?.abort()}
                />
              </>
            )}

            {song && (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetImport}
                    className="ui-touch inline-flex items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink"
                  >
                    New search
                  </button>
                </div>
                {ai.status === "done" && (
                  <>
                    <ToolActivityList tools={ai.tools} />
                    <UsageDetails usage={ai.usage} />
                  </>
                )}
              </>
            )}

            {importing && !song && (
              <p className="text-sm text-ink-3">Fetching cited lyrics for the selected song…</p>
            )}

            {showCandidates && (
              <SongCandidateList
                candidates={candidates}
                disabled={importing}
                onChoose={(candidate) => void importCandidate(candidate)}
              />
            )}

            {song && (
              <SongStudy
                song={withYouTubeCandidate(song, youtubeUrl)}
                saved={false}
                dirty
                youtubeUrl={youtubeUrl}
                onYouTubeUrlChange={(next) => {
                  setYoutubeUrl(next);
                  setLoadedVideoId(null);
                }}
                loadedVideoId={loadedVideoId}
                onLoadPlayer={setLoadedVideoId}
                mode={mode}
                onModeChange={setMode}
                selected={selected}
                onSelect={setSelected}
                onSave={() => void saveLocally()}
              />
            )}
          </div>
        )}
      </DetailShell>
    </>
  );
}
