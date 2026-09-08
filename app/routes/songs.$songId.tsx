import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/songs.$songId";
import { DetailShell } from "~/components/DetailShell";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { SongStudy } from "~/components/songs/SongStudy";
import type { DetailMode, TokenSelection } from "~/components/translate/TranslateDocument";
import { serializeSongContext } from "~/lib/ai/context";
import { loadCompareCatalog } from "~/lib/detail-data";
import { buildLexicon } from "~/lib/segment";
import { deleteSavedSong, getSavedSong, putSavedSong } from "~/lib/song-db.client";
import {
  hydrateSavedSong,
  songsHref,
  toSavedSongRecord,
  withYouTubeCandidate,
  youtubeWatchUrl,
  type BoundSong,
  type SavedSongRecord,
} from "~/lib/song";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.record?.title;
  if (!title) return [{ title: "Song — Mandarin" }];
  return [{ title: `${title} — Songs` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const [catalog, record] = await Promise.all([
    loadCompareCatalog(),
    getSavedSong(params.songId),
  ]);
  return { catalog, record, songId: params.songId };
}
clientLoader.hydrate = true as const;

export default function SavedSongPage({ loaderData }: Route.ComponentProps) {
  const { catalog, record, songId } = loaderData;
  const navigate = useNavigate();
  const lexicon = useMemo(
    () => buildLexicon({ hanzi: catalog.hanzi, words: catalog.words }),
    [catalog],
  );
  const [stored, setStored] = useState<SavedSongRecord | null>(record);
  const hydrated = useMemo(
    () => (stored ? hydrateSavedSong(stored, lexicon) : null),
    [stored, lexicon],
  );
  const song = hydrated?.ok ? hydrated.song : null;
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl(record, song));
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [mode, setMode] = useState<DetailMode>("embed");
  const [selected, setSelected] = useState<TokenSelection | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStored(record);
  }, [record]);

  useEffect(() => {
    setYoutubeUrl(initialYoutubeUrl(stored, song));
    setLoadedVideoId(null);
    setSelected(null);
  }, [stored?.id]);

  const working = useMemo(
    () => (song ? withYouTubeCandidate(song, youtubeUrl) : null),
    [song, youtubeUrl],
  );
  const dirty = Boolean(
    working && stored && working.youtubeVideoId !== (stored.youtubeVideoId ?? undefined),
  );
  const context = useMemo(
    () => (working ? serializeSongContext(working, `/songs/${songId}`) : null),
    [working, songId],
  );

  if (!stored) {
    return (
      <DetailShell current="Missing" fallback={{ to: songsHref(), label: "Songs" }}>
        <p className="text-[15px] leading-7 text-ink-2">
          This song is not on this device. Saved songs stay in this browser’s IndexedDB and are not
          synced.
        </p>
        <Link
          to={songsHref()}
          className="ui-touch mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
        >
          Back to Songs
        </Link>
      </DetailShell>
    );
  }

  if (!working) {
    return (
      <DetailShell current="Unreadable" fallback={{ to: songsHref(), label: "Songs" }}>
        <p className="text-[15px] leading-7 text-ink-2">
          This saved song could not be opened
          {hydrated && !hydrated.ok ? `: ${hydrated.error}` : "."}
        </p>
        <Link
          to={songsHref()}
          className="ui-touch mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
        >
          Back to Songs
        </Link>
      </DetailShell>
    );
  }

  return (
    <>
      {context ? <PageContextBridge context={context} /> : null}
      <DetailShell current={working.title} fallback={{ to: songsHref(), label: "Songs" }}>
        <SongStudy
          song={working}
          saved
          dirty={dirty}
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
          saving={saving}
          onSave={() => {
            void (async () => {
              setSaving(true);
              try {
                const next = toSavedSongRecord(working, stored.id, {
                  createdAt: stored.createdAt,
                  updatedAt: Date.now(),
                });
                await putSavedSong(next);
                setStored(next);
              } finally {
                setSaving(false);
              }
            })();
          }}
          onDelete={() => {
            void (async () => {
              await deleteSavedSong(stored.id);
              navigate(songsHref());
            })();
          }}
          deleteOpen={deleteOpen}
          onDeleteOpenChange={setDeleteOpen}
        />
      </DetailShell>
    </>
  );
}

function initialYoutubeUrl(record: SavedSongRecord | null, song: BoundSong | null): string {
  if (record?.youtubeVideoId) return youtubeWatchUrl(record.youtubeVideoId);
  return song?.youtubeUrl ?? "";
}
