import { DetailLink } from "~/components/DetailLink";
import clsx from "clsx";
import { Chip, Section, StatusDot } from "~/components/ui";
import { Prose } from "~/components/DetailShell";
import { Sentences } from "~/components/Sentences";
import type { WordDetailData } from "~/lib/detail-data";

const TRANSPARENCY_NOTE = {
  transparent: "The characters give this one away.",
  semi: "Derivable, once one thing is explained.",
  opaque: "Not derivable from the characters — this one is memorised.",
} as const;

export function WordDetailContent({ data }: { data: WordDetailData }) {
  const { word: w, chars, topics } = data;
  const a = w.authored;

  return (
    <>
      <div className="ui-card flex flex-wrap items-baseline gap-4 px-4 py-5 sm:px-6">
        <span className="han text-5xl leading-none sm:text-6xl">{w.word}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg text-ink">{w.pinyin}</span>
            <Chip tone="accent">{w.extra ? "Extra" : `HSK ${w.level}`}</Chip>
            {w.pos.map((p) => (
              <Chip key={p} tone="quiet">
                {p}
              </Chip>
            ))}
            {w.traditional && (
              <Chip tone="neutral" title="Traditional form">
                <span className="han">{w.traditional}</span>
              </Chip>
            )}
            <span className="flex w-full items-center gap-1.5 text-xs text-ink-3 sm:ml-auto sm:w-auto">
              <StatusDot status={a?.status ?? "stub"} />
              {a?.status ?? "not yet written"}
            </span>
          </div>
          {topics.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {topics.map((t) => (
                <DetailLink
                  key={t.id}
                  to={`/topics/${t.id}`}
                  className="ui-touch inline-flex items-center rounded-full bg-accent-soft px-3 text-xs text-accent transition-opacity hover:opacity-75 sm:min-h-8"
                >
                  {t.label}
                </DetailLink>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-sm text-ink-2">{w.meanings.join("; ")}</p>
          {w.classifiers.length > 0 && (
            <p className="mt-1 text-xs text-ink-3">
              classifier <span className="han">{w.classifiers.join(" ")}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {a && (
          <Section
            title="Literal vs actual"
            aside={
              <span className="text-xs text-ink-3">
                {a.formation} · confidence: {a.confidence}
              </span>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-sunk px-4 py-3">
                <p className="ui-eyebrow">Literally</p>
                <p className="mt-1 text-sm text-ink-2">{a.literal}</p>
              </div>
              <div
                className={clsx(
                  "rounded-xl border px-4 py-3",
                  a.transparency === "opaque"
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface",
                )}
              >
                <p className="ui-eyebrow">Actually</p>
                <p
                  className={clsx(
                    "mt-1 text-sm",
                    a.transparency === "opaque" ? "text-accent" : "text-ink",
                  )}
                >
                  {a.actual}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-3">{TRANSPARENCY_NOTE[a.transparency]}</p>
          </Section>
        )}

        {a?.why ? (
          <Section title="Why this combination">
            <Prose>{a.why}</Prose>
            {a.sources.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-xs text-ink-3">
                {a.sources.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            )}
          </Section>
        ) : (
          <Section title="Why this combination">
            <p className="text-sm text-ink-3">
              Not yet written. Ask Claude Code to “fill in word content
              {w.extra ? "" : ` for HSK ${w.level}`}”.
            </p>
          </Section>
        )}

        {a?.notes && (
          <Section title="Notes">
            <Prose>{a.notes}</Prose>
          </Section>
        )}

        <Section title="Character by character">
          <div className="grid gap-2 sm:grid-cols-2">
            {chars.map((c, i) => (
              <DetailLink
                key={`${c.char}-${i}`}
                to={`/hanzi/${encodeURIComponent(c.char)}`}
                className="ui-card ui-card-interactive flex min-h-16 items-center gap-3 px-3 py-2"
              >
                <span className="han w-10 shrink-0 text-center text-3xl">{c.char}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-2">{c.pinyin}</span>
                  <span className="block truncate text-xs text-ink-3">{c.meaning}</span>
                </span>
                {c.level && <Chip tone="quiet">HSK {c.level}</Chip>}
              </DetailLink>
            ))}
          </div>
        </Section>

        <Section
          title="Examples"
          aside={
            <span className="text-xs text-ink-3">
              only characters from HSK {w.level} and below
            </span>
          }
        >
          <Sentences sentences={w.sentences} highlight={w.word} />
        </Section>
      </div>
    </>
  );
}
