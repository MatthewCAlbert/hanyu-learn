import { Link } from "react-router";
import { songHref, type SavedSongRecord } from "~/lib/song";

export function SavedSongList({ songs }: { songs: SavedSongRecord[] }) {
  if (songs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-12 text-center text-sm text-ink-3">
        No saved songs on this device. Import one, then press Save locally. Songs never leave this
        browser.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {songs.map((song) => (
        <li key={song.id}>
          <Link to={songHref(song.id)} className="ui-card ui-card-interactive block px-4 py-4">
            <p className="han text-lg text-ink">{song.title}</p>
            <p className="mt-1 text-sm text-ink-2">{song.artist}</p>
            <p className="mt-1 text-xs text-ink-3">
              {[song.album, song.year, song.complete ? null : "incomplete"]
                .filter(Boolean)
                .join(" · ") || "Saved locally"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
