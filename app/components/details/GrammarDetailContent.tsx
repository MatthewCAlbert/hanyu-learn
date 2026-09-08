import { DetailLink } from "~/components/DetailLink";
import { Chip, Section, StatusDot } from "~/components/ui";
import { Prose } from "~/components/DetailShell";
import { levelLabel } from "~/lib/levels";
import type { GrammarDetailData } from "~/lib/detail-data";

export function GrammarDetailContent({ data }: { data: GrammarDetailData }) {
  const { lesson, hanzi, words, prerequisites } = data;
  const a = lesson;

  return (
    <>
      <div className="ui-card px-4 py-5 sm:px-6">
        <p className="han text-3xl leading-tight sm:text-4xl">{a.pattern}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg text-ink">{a.title}</h1>
          <Chip tone="accent">HSK {levelLabel(a.level)}</Chip>
          <span className="flex w-full items-center gap-1.5 text-xs text-ink-3 sm:ml-auto sm:w-auto">
            <StatusDot status={a.status} />
            {a.status}
          </span>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {prerequisites.length > 0 && (
          <Section title="Before this">
            <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
              {prerequisites.map((g) => (
                <DetailLink
                  key={g.id}
                  to={`/grammar/${g.id}`}
                  className="ui-card ui-card-interactive flex min-h-14 min-w-0 flex-col justify-center overflow-hidden px-3 py-2"
                >
                  <span className="han text-base">{g.pattern}</span>
                  <span className="truncate text-xs text-ink-3">
                    {g.title} · HSK {g.level}
                  </span>
                </DetailLink>
              ))}
            </div>
          </Section>
        )}

        {a.patternNotes ? (
          <Section title="Pattern">
            <Prose>{a.patternNotes}</Prose>
          </Section>
        ) : (
          <Section title="Pattern">
            <p className="text-sm text-ink-3">
              Not yet written. Ask Claude Code to “fill in grammar lessons for HSK {a.level}”, or
              see <code className="rounded bg-sunk px-1">docs/RESEARCH-PLAYBOOK.md</code>.
            </p>
          </Section>
        )}

        {a.usage && (
          <Section title="Usage">
            <Prose>{a.usage}</Prose>
          </Section>
        )}

        {a.notes && (
          <Section title="Notes">
            <Prose>{a.notes}</Prose>
          </Section>
        )}

        {hanzi.length + words.length > 0 && (
          <Section
            title="Linked entries"
            aside={
              <span className="text-xs text-ink-3">
                {hanzi.length} hanzi · {words.length} word{words.length === 1 ? "" : "s"}
              </span>
            }
          >
            <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
              {hanzi.map((h) => (
                <DetailLink
                  key={`h-${h.char}`}
                  to={`/hanzi/${encodeURIComponent(h.char)}`}
                  className="ui-card ui-card-interactive flex min-h-14 min-w-0 items-center gap-3 overflow-hidden px-3 py-2"
                >
                  <span className="han text-2xl">{h.char}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-2">{h.pinyin}</span>
                    <span className="block truncate text-xs text-ink-3">{h.meaning}</span>
                  </span>
                  <Chip tone="quiet">HSK {h.level}</Chip>
                </DetailLink>
              ))}
              {words.map((w) => (
                <DetailLink
                  key={`w-${w.word}`}
                  to={`/words/${encodeURIComponent(w.word)}`}
                  className="ui-card ui-card-interactive flex min-h-14 min-w-0 items-center gap-3 overflow-hidden px-3 py-2"
                >
                  <span className="han text-2xl">{w.word}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-2">{w.pinyin}</span>
                    <span className="block truncate text-xs text-ink-3">{w.meaning}</span>
                  </span>
                  <Chip tone="quiet">{w.extra ? "Extra" : `HSK ${w.level}`}</Chip>
                </DetailLink>
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Examples"
          aside={
            <span className="text-xs text-ink-3">
              only characters from HSK {levelLabel(a.level)} and below
            </span>
          }
        >
          {a.examples.length === 0 ? (
            <p className="text-sm text-ink-3">No authored examples yet.</p>
          ) : (
            <div className="space-y-3">
              {a.examples.map((s) => (
                <div
                  key={`${s.cmn}:${s.eng}`}
                  className="rounded-r-lg border-l-2 border-line bg-surface/50 py-2 pr-3 pl-3"
                >
                  <p className="han text-lg leading-relaxed">{s.cmn}</p>
                  <p className="mt-1 text-sm text-ink-2">{s.eng}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {a.sources.length > 0 && (
          <Section title="Sources">
            <ul className="space-y-0.5 text-xs text-ink-3">
              {a.sources.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
