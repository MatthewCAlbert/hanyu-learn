import type { SongCandidate } from "~/lib/song";

export function SongCandidateList({
  candidates,
  disabled,
  onChoose,
}: {
  candidates: SongCandidate[];
  disabled?: boolean;
  onChoose: (candidate: SongCandidate) => void;
}) {
  if (candidates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-12 text-center text-sm text-ink-3">
        No matching songs from search. Try a Chinese title, artist, or a short lyric line.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {candidates.map((candidate, index) => (
        <li key={`${candidate.title}:${candidate.artist}:${index}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChoose(candidate)}
            className="ui-card ui-card-interactive ui-touch w-full px-4 py-4 text-left disabled:opacity-40"
          >
            <p className="han text-lg text-ink">{candidate.title}</p>
            <p className="mt-0.5 text-sm text-ink-3">{candidate.titlePinyin}</p>
            <p className="mt-1 text-sm text-ink-2">{candidate.artist}</p>
            {(candidate.album || candidate.year) && (
              <p className="mt-1 text-xs text-ink-3">
                {[candidate.album, candidate.year].filter(Boolean).join(" · ")}
              </p>
            )}
            {candidate.reason && <p className="mt-2 text-sm text-ink-2">{candidate.reason}</p>}
            {candidate.youtubeUrl && (
              <p className="mt-2 truncate text-xs text-ink-3" title={candidate.youtubeUrl}>
                YouTube candidate found
              </p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
