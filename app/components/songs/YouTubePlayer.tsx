import { useId } from "react";
import {
  parseYouTubeVideoId,
  youtubePrivacyEmbedUrl,
} from "~/lib/song";

export function YouTubePlayer({
  url,
  onUrlChange,
  loadedId,
  onLoad,
  disabled,
  title,
}: {
  url: string;
  onUrlChange: (next: string) => void;
  loadedId: string | null;
  onLoad: (id: string) => void;
  disabled?: boolean;
  title: string;
}) {
  const inputId = useId();
  const videoId = parseYouTubeVideoId(url);
  const showPlayer = Boolean(loadedId && videoId && loadedId === videoId);

  return (
    <section className="ui-card min-w-0 px-4 py-4">
      <h2 className="ui-eyebrow">YouTube</h2>
      <label htmlFor={inputId} className="mt-2 block text-sm text-ink-2">
        Candidate URL
      </label>
      <input
        id={inputId}
        type="url"
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        disabled={disabled}
        placeholder="https://www.youtube.com/watch?v=…"
        autoComplete="off"
        spellCheck={false}
        className="ui-touch mt-1.5 min-w-0 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
      />
      <p className="mt-2 text-xs text-ink-3">
        Confirm the link before the player loads. Playback starts from YouTube’s controls — this app
        never autoplays.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !videoId}
          onClick={() => {
            if (!videoId) return;
            onLoad(videoId);
          }}
          className="ui-touch inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40"
        >
          Load player
        </button>
      </div>
      {url.trim() && !videoId && (
        <p className="mt-2 text-sm text-accent">
          Use a YouTube watch, youtu.be, Shorts, or embed URL.
        </p>
      )}
      {showPlayer && loadedId && (
        <div className="mt-4 overflow-hidden rounded-xl bg-sunk">
          <div className="relative w-full pt-[56.25%]">
            <iframe
              src={youtubePrivacyEmbedUrl(loadedId)}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>
      )}
    </section>
  );
}
