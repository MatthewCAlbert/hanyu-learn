import { Link } from "react-router";
import clsx from "clsx";
import type { Route } from "./+types/words.$word";
import { getWordPage } from "~/lib/data.client";
import { Chip, Section, StatusDot } from "~/components/ui";
import { DetailShell, Prose } from "~/components/DetailShell";
import { Sentences } from "~/components/Sentences";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.word.word} ${loaderData.word.pinyin} — Mandarin` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const text = decodeURIComponent(params.word);
  const page = await getWordPage(text);
  if (!page) throw new Response(`${text} is not in HSK 1–9`, { status: 404 });
  return page;
}
clientLoader.hydrate = true as const;

const TRANSPARENCY_NOTE = {
  transparent: "The characters give this one away.",
  semi: "Derivable, once one thing is explained.",
  opaque: "Not derivable from the characters — this one is memorised.",
} as const;

export default function WordDetail({ loaderData }: Route.ComponentProps) {
  const { word: w, chars, topics } = loaderData;
  const a = w.authored;

  return (
    <DetailShell back={{ to: `/hsk/${w.level}/words`, label: `HSK ${w.level} words` }}>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="han text-6xl leading-none">{w.word}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg text-ink">{w.pinyin}</span>
            <Chip tone="accent">HSK {w.level}</Chip>
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
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-3">
              <StatusDot status={a?.status ?? "stub"} />
              {a?.status ?? "not yet written"}
            </span>
          </div>
          {topics.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
            {topics.map((t) => (
              <Link
                key={t.id}
                to={`/topics/${t.id}`}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] leading-4 text-accent transition-opacity hover:opacity-75"
              >
                {t.label}
              </Link>
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
        {/* ------------------------------------------- literal vs actual */}
        {a && (
          <Section
            title="Literal vs actual"
            aside={
              <span className="text-[11px] text-ink-3">
                {a.formation} · confidence: {a.confidence}
              </span>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-sunk px-4 py-3">
                <p className="text-[11px] tracking-wide text-ink-3 uppercase">Literally</p>
                <p className="mt-1 text-sm text-ink-2">{a.literal}</p>
              </div>
              <div
                className={clsx(
                  "rounded-lg border px-4 py-3",
                  a.transparency === "opaque"
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface",
                )}
              >
                <p className="text-[11px] tracking-wide text-ink-3 uppercase">Actually</p>
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
              <ul className="mt-3 space-y-0.5 text-[11px] text-ink-3">
                {a.sources.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            )}
          </Section>
        ) : (
          <Section title="Why this combination">
            <p className="text-sm text-ink-3">
              Not yet written. Ask Claude Code to “fill in word content for HSK {w.level}”.
            </p>
          </Section>
        )}

        {a?.notes && (
          <Section title="Notes">
            <Prose>{a.notes}</Prose>
          </Section>
        )}

        {/* ----------------------------------------- character breakdown */}
        <Section title="Character by character">
          <div className="grid gap-2 sm:grid-cols-2">
            {chars.map((c, i) => (
              <Link
                key={`${c.char}-${i}`}
                to={`/hanzi/${encodeURIComponent(c.char)}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:border-accent"
              >
                <span className="han w-10 shrink-0 text-center text-3xl">{c.char}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-2">{c.pinyin}</span>
                  <span className="block truncate text-[11px] text-ink-3">{c.meaning}</span>
                </span>
                {c.level && <Chip tone="quiet">HSK {c.level}</Chip>}
              </Link>
            ))}
          </div>
        </Section>

        <Section
          title="Examples"
          aside={
            <span className="text-[11px] text-ink-3">
              only characters from HSK {w.level} and below
            </span>
          }
        >
          <Sentences sentences={w.sentences} highlight={w.word} />
        </Section>
      </div>
    </DetailShell>
  );
}
