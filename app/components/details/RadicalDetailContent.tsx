import { Link } from "react-router";
import { Chip, Section, StatusDot } from "~/components/ui";
import type { RadicalDetailData } from "~/lib/detail-data";

export function RadicalDetailContent({ data }: { data: RadicalDetailData }) {
  const { radical: r, byLevel, total } = data;

  return (
    <>
      <div className="ui-card flex flex-wrap items-center gap-5 px-4 py-5 sm:px-6">
        <span className="han text-7xl leading-none">{r.display}</span>
        <div>
          <h1 className="text-xl text-ink">{r.gloss}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <Chip tone="neutral">Kangxi #{r.number}</Chip>
            <Chip tone="quiet">
              {r.strokes} stroke{r.strokes > 1 ? "s" : ""}
            </Chip>
            {r.variants.filter((v) => v !== r.display).length > 0 && (
              <span className="text-ink-3">
                also written{" "}
                <span className="han">{r.variants.filter((v) => v !== r.display).join(" ")}</span>
              </span>
            )}
          </p>
          <p className="mt-2 text-sm text-ink-3">
            {total} character{total === 1 ? "" : "s"} in HSK 1–9
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-ink-3">
            Dictionary grouping follows Unicode Unihan. It is not always the meaning-bearing
            component — check 义 / 声 on each card.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {byLevel.map(({ level, members }) => (
          <Section
            key={level}
            title={`HSK ${level}`}
            aside={<span className="text-xs text-ink-3">{members.length}</span>}
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              {members.map((m) => (
                <div
                  key={m.char}
                  className="ui-card ui-card-interactive flex min-h-16 flex-wrap items-center gap-2 px-3 py-2"
                >
                  <Link
                    to={`/hanzi/${encodeURIComponent(m.char)}`}
                    className="flex min-w-[12rem] flex-1 items-center gap-3"
                  >
                    <span className="han w-10 shrink-0 text-center text-3xl">{m.char}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-ink-2">{m.pinyin}</span>
                      <span className="block truncate text-xs text-ink-3">{m.meaning}</span>
                    </span>
                    {m.semantic && (
                      <span className="shrink-0 text-xs text-ink-3" title="meaning component">
                        义 <span className="han">{m.semantic}</span>
                      </span>
                    )}
                  </Link>
                  {m.phonetic && (
                    <Link
                      to={`/phonetic/${encodeURIComponent(m.phonetic)}`}
                      className="ui-touch inline-flex shrink-0 items-center rounded-lg px-2 text-xs text-ink-3 hover:text-accent sm:min-h-8"
                      title="phonetic component"
                    >
                      声 <span className="han">{m.phonetic}</span>
                    </Link>
                  )}
                  <StatusDot status={m.status} />
                </div>
              ))}
            </div>
          </Section>
        ))}
      </div>
    </>
  );
}
