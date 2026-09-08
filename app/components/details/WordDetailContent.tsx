import { DetailLink } from "~/components/DetailLink";
import clsx from "clsx";
import { Chip, Section, StatusDot } from "~/components/ui";
import { Prose } from "~/components/DetailShell";
import { Sentences } from "~/components/Sentences";
import { GlossaryLegend, GlossaryTerm } from "~/components/GlossaryTerm";
import { RelationSections } from "~/components/details/RelationSections";
import { GrammarLessonsSection } from "~/components/details/GrammarLessonsSection";
import { PronunciationButton } from "~/components/PronunciationButton";
import type { WordDetailData } from "~/lib/detail-data";
import type { GlossaryKey } from "~/lib/lexical-glossary";

const TRANSPARENCY_NOTE = {
  transparent: "The characters give this one away.",
  semi: "Derivable, once one thing is explained.",
  opaque: "Not derivable from the characters — this one is memorised.",
} as const;

export function WordDetailContent({ data }: { data: WordDetailData }) {
  const { word: w, chars, topics, relations, grammar, usage } = data;
  const a = w.authored;
  const contributionTerms: GlossaryKey[] = [];
  for (const c of chars) {
    if (!c.link) continue;
    if (!contributionTerms.includes(c.link.role)) contributionTerms.push(c.link.role);
    if (!contributionTerms.includes(c.link.transparency)) {
      contributionTerms.push(c.link.transparency);
    }
  }
  if (a?.transparency === "opaque" && !contributionTerms.includes("opaque")) {
    contributionTerms.push("opaque");
  }

  return (
    <>
      <div className="ui-card flex flex-wrap items-baseline gap-4 px-4 py-5 sm:px-6">
        <span className="han text-5xl leading-none sm:text-6xl">{w.word}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="text-lg text-ink">{w.pinyin}</span>
              <PronunciationButton form={w.word} pinyin={w.pinyin} preferWordClip />
            </span>
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
            <p className="mt-2 text-xs text-ink-3">
              {a.transparency === "opaque" ? (
                <GlossaryTerm term="opaque">{TRANSPARENCY_NOTE.opaque}</GlossaryTerm>
              ) : (
                TRANSPARENCY_NOTE[a.transparency]
              )}
            </p>
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

        {usage && (
          <Section
            title="Textbook vs everyday"
            aside={<span className="text-xs text-ink-3">{usage.assessment}</span>}
          >
            <p className="text-sm text-ink-2">
              {usage.register ?? "unspecified register"}
              {usage.contexts.length > 0 && <> · {usage.contexts.join(", ")}</>}
              {usage.regions.length > 0 && <> · {usage.regions.join(", ")}</>}
              <> · {usage.currency}</>
            </p>
            {usage.evidence.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-ink-3">
                {usage.evidence.map((e) => (
                  <li key={`${e.kind}:${e.source}`}>
                    · {e.kind}: {e.source}
                    {e.note ? ` — ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <RelationSections relations={relations} current={w.word} />

        <GrammarLessonsSection lessons={grammar} />

        <Section title="Character by character">
          {contributionTerms.length > 0 && <GlossaryLegend terms={contributionTerms} />}
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {chars.map((c, i) => (
              <div
                key={`${c.char}-${i}`}
                className="ui-card flex min-w-0 flex-col gap-1 overflow-hidden px-3 py-2"
              >
                <DetailLink
                  to={`/hanzi/${encodeURIComponent(c.char)}`}
                  className="ui-card-interactive -mx-3 -my-2 flex min-h-14 min-w-0 items-center gap-3 px-3 py-2"
                >
                  <span className="han w-10 shrink-0 text-center text-3xl">{c.char}</span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block text-xs text-ink-2">{c.pinyin}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {c.link?.contribution ?? c.meaning}
                    </span>
                  </span>
                  {c.level && <Chip tone="quiet">HSK {c.level}</Chip>}
                </DetailLink>
                {c.link && (
                  <span className="flex flex-wrap gap-1">
                    <GlossaryTerm term={c.link.role} />
                    <GlossaryTerm term={c.link.transparency} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Examples"
          aside={
            <span className="text-xs text-ink-3">only characters from HSK {w.level} and below</span>
          }
        >
          <Sentences sentences={w.sentences} highlight={w.word} />
        </Section>
      </div>
    </>
  );
}
