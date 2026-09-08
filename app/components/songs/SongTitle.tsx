import { DetailLink } from "~/components/DetailLink";
import { entryPath } from "~/lib/compare";
import type { BoundSong } from "~/lib/song";

export function SongTitle({ song }: { song: BoundSong }) {
  const spans = song.titleAnalysis.blocks[0]?.spans ?? [];
  const linked = spans.filter((span) => span.ref && span.summary);

  return (
    <div className="min-w-0">
      <h1 className="han wrap-anywhere text-3xl text-ink">
        {spans.length === 0
          ? song.title
          : spans.map((span) => {
              if (!span.ref) return <span key={span.id}>{span.text}</span>;
              const summary = span.summary;
              const detail = summary
                ? `${summary.pinyin}${summary.meaning ? ` · ${summary.meaning}` : ""}`
                : "Open corpus entry";
              return (
                <DetailLink
                  key={span.id}
                  to={entryPath({ kind: span.ref.kind, id: span.ref.id })}
                  aria-label={`${span.text}: ${detail}`}
                  className="rounded-sm decoration-accent/60 decoration-1 underline-offset-4 hover:text-accent hover:underline"
                >
                  {span.text}
                </DetailLink>
              );
            })}
      </h1>
      {linked.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 font-sans">
          {linked.map((span) => {
            const summary = span.summary;
            if (!span.ref || !summary) return null;
            const level = summary.extra ? "Extra" : summary.level ? `HSK ${summary.level}` : null;
            return (
              <li key={span.id}>
                <DetailLink
                  to={entryPath({ kind: span.ref.kind, id: span.ref.id })}
                  className="wrap-anywhere text-sm leading-5 text-ink-2 hover:text-accent"
                >
                  {summary.pinyin}
                  {summary.meaning ? ` · ${summary.meaning}` : ""}
                  {level ? ` · ${level}` : ""}
                </DetailLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
