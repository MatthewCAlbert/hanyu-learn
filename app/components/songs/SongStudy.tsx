import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ConfirmDialog } from "~/components/Dialog";
import {
  TranslateDocument,
  type DetailMode,
  type TokenSelection,
} from "~/components/translate/TranslateDocument";
import { SongTitle } from "~/components/songs/SongTitle";
import { YouTubePlayer } from "~/components/songs/YouTubePlayer";
import { useAiStore } from "~/lib/ai/store";
import { lyricSectionNav, type BoundSong } from "~/lib/song";

export function SongStudy({
  song,
  saved,
  dirty,
  youtubeUrl,
  onYouTubeUrlChange,
  loadedVideoId,
  onLoadPlayer,
  mode,
  onModeChange,
  selected,
  onSelect,
  saving,
  onSave,
  onDelete,
  deleteOpen,
  onDeleteOpenChange,
}: {
  song: BoundSong;
  saved: boolean;
  dirty: boolean;
  youtubeUrl: string;
  onYouTubeUrlChange: (next: string) => void;
  loadedVideoId: string | null;
  onLoadPlayer: (id: string) => void;
  mode: DetailMode;
  onModeChange: (next: DetailMode) => void;
  selected: TokenSelection | null;
  onSelect: (next: TokenSelection | null) => void;
  saving?: boolean;
  onSave: () => void;
  onDelete?: () => void;
  deleteOpen?: boolean;
  onDeleteOpenChange?: (open: boolean) => void;
}) {
  const appendComposer = useAiStore((state) => state.appendComposer);
  const openChat = useAiStore((state) => state.openPanel);
  const setChatListOpen = useAiStore((state) => state.setListOpen);
  const saveLabel = saved ? (dirty ? "Save changes" : "Saved") : "Save locally";
  const sections = useMemo(() => lyricSectionNav(song.headings), [song.headings]);
  const headings = useMemo(
    () =>
      sections.map((item, i) => ({
        blockId: song.headings[i]?.blockId ?? item.targetId,
        label: item.label,
        targetId: item.targetId,
      })),
    [sections, song.headings],
  );
  const sectionNavRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState(sections[0]?.targetId ?? "");

  useEffect(() => {
    if (sections.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const headerHeight =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--app-header-height"),
        ) || 0;
      const threshold = headerHeight + (sectionNavRef.current?.offsetHeight ?? 0) + 8;
      let next = sections[0]?.targetId ?? "";

      for (const section of sections) {
        const heading = document.getElementById(section.targetId);
        if (!heading || heading.getBoundingClientRect().top > threshold) break;
        next = section.targetId;
      }

      const atPageEnd =
        document.documentElement.scrollHeight > window.innerHeight &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atPageEnd) next = sections.at(-1)?.targetId ?? next;
      setActiveSection(next);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [sections]);

  useEffect(() => {
    const nav = sectionNavRef.current;
    const link = nav?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
    if (!nav || !link) return;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    if (left < nav.scrollLeft) {
      nav.scrollTo({ left, behavior: "smooth" });
    } else if (right > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: right - nav.clientWidth, behavior: "smooth" });
    }
  }, [activeSection]);

  return (
    <div className="min-w-0 space-y-6">
      <header className="min-w-0 space-y-2">
        <SongTitle song={song} />
        <p className="text-base text-ink-2">{song.artist}</p>
        {(song.album || song.year) && (
          <p className="text-sm text-ink-3">{[song.album, song.year].filter(Boolean).join(" · ")}</p>
        )}
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink-2">
          AI imported — verify with source. Lyrics stay on this device and are not part of the HSK
          corpus.
        </p>
        {song.warning && (
          <p className="wrap-anywhere text-sm text-accent">{song.warning}</p>
        )}
        {!song.complete && !song.unavailable && (
          <p className="text-sm text-ink-2">Lyrics look incomplete. Check the cited source.</p>
        )}
        {song.unavailable && (
          <p className="text-sm text-ink-2">
            Full lyrics were not available from the cited source. Nothing was invented.
          </p>
        )}
        {song.citations.length > 0 && (
          <ul className="min-w-0 space-y-1">
            {song.citations.map((citation) => (
              <li key={citation.url} className="min-w-0">
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="wrap-anywhere block max-w-full text-sm text-accent hover:underline"
                >
                  {citation.title || citation.url}
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || (saved && !dirty)}
            className="ui-touch inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40"
          >
            {saveLabel}
          </button>
          {saved && onDelete && onDeleteOpenChange && (
            <button
              type="button"
              onClick={() => onDeleteOpenChange(true)}
              className="ui-touch inline-flex items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      <YouTubePlayer
        url={youtubeUrl}
        onUrlChange={onYouTubeUrlChange}
        loadedId={loadedVideoId}
        onLoad={onLoadPlayer}
        title={`${song.title} — ${song.artist}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="ui-eyebrow">Lyrics</h2>
        <OpenModeToggle mode={mode} onChange={onModeChange} />
      </div>

      {sections.length > 1 && (
        <nav
          ref={sectionNavRef}
          aria-label="Lyric sections"
          className="hide-scrollbar sticky z-10 -mx-4 flex snap-x gap-1 overflow-x-auto border-b border-line bg-paper/95 px-4 py-1 backdrop-blur lg:-mx-8 lg:px-8"
          style={{ top: "var(--app-header-height, 0px)" }}
        >
          {sections.map((item) => {
            const active = item.targetId === activeSection;
            return (
              <a
                key={item.targetId}
                href={`#${item.targetId}`}
                data-section={item.targetId}
                aria-current={active ? "location" : undefined}
                onClick={() => setActiveSection(item.targetId)}
                className={clsx(
                  "ui-touch inline-flex shrink-0 snap-start items-center rounded-xl px-3 text-sm font-medium",
                  active
                    ? "bg-ink text-paper"
                    : "text-ink-2 hover:bg-sunk hover:text-ink",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      )}

      {song.unavailable ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-12 text-center text-sm text-ink-3">
          No lyric lines to study. Try another source or a different recording.
        </p>
      ) : (
        <TranslateDocument
          analysis={song.analysis}
          mode={mode}
          selected={selected}
          onSelect={onSelect}
          translations={song.paragraphs}
          headings={headings}
          onAddToChat={(line) => {
            appendComposer(`“${line.trim()}”`);
            setChatListOpen(false);
            openChat();
          }}
        />
      )}

      {onDelete && onDeleteOpenChange && (
        <ConfirmDialog
          open={Boolean(deleteOpen)}
          onOpenChange={onDeleteOpenChange}
          title="Delete song"
          description={`Delete “${song.title}” from this device? This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}

function OpenModeToggle({
  mode,
  onChange,
}: {
  mode: DetailMode;
  onChange: (next: DetailMode) => void;
}) {
  return (
    <fieldset className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
      <legend className="sr-only">Open entries</legend>
      {(
        [
          ["embed", "Embed"],
          ["direct", "Direct"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={clsx(
            "ui-touch min-w-20 rounded-lg px-3 text-sm font-medium",
            mode === value ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
