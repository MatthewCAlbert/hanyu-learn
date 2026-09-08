import { SONG_QUERY_MAX } from "~/lib/song";

export function SongSearchForm({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !value.trim()) return;
        onSubmit();
      }}
    >
      <label className="block">
        <span className="ui-eyebrow">Search</span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.key === "Process") return;
            if (event.key === "Enter") {
              event.preventDefault();
              if (!disabled && value.trim()) onSubmit();
            }
          }}
          maxLength={SONG_QUERY_MAX}
          autoComplete="off"
          spellCheck={false}
          placeholder="Title, artist, pinyin, Hanzi, or a lyric fragment"
          aria-label="Song search"
          className="ui-touch mt-2 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none placeholder:text-ink-3 focus:border-accent"
        />
      </label>
      <p className="mt-2 text-xs text-ink-3">
        Press Enter or Find songs. Lyrics are fetched only after you choose a match.
      </p>
    </form>
  );
}
