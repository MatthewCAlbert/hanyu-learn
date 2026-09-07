import { Link } from "react-router";
import type { Route } from "./+types/phonetic.$component";
import { getPhoneticSeries } from "~/lib/data.client";
import { LEVELS, formatLevels, levelLabel } from "~/lib/levels";
import { toneless } from "~/lib/pinyin";
import { Chip, Section, StatusDot } from "~/components/ui";
import { DetailShell } from "~/components/DetailShell";
import type { Level } from "~/lib/types";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  const { meta } = loaderData;
  return [
    { title: `Phonetic ${meta.component}${meta.pinyin[0] ? ` ${meta.pinyin[0]}` : ""} — Mandarin` },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const component = decodeURIComponent(params.component);
  const series = await getPhoneticSeries(component);
  if (!series || series.members.length === 0) {
    throw new Response(`No phonetic series ${component} in HSK 1–9`, { status: 404 });
  }

  const members = [...series.members].sort(
    (a, b) => a.level - b.level || a.char.localeCompare(b.char),
  );
  const byLevel = LEVELS.map((level) => ({
    level,
    members: members.filter((m) => m.level === level),
  })).filter((g) => g.members.length > 0);

  return { meta: series.meta, byLevel, total: members.length };
}
clientLoader.hydrate = true as const;

function pinyinFit(anchor: string[], member: string): "same" | "tone" | "diverged" {
  const memberFirst = member.split(/[\s'·]+/)[0] ?? member;
  for (const a of anchor) {
    const aFirst = a.split(/[\s'·]+/)[0] ?? a;
    if (aFirst === memberFirst) return "same";
  }
  const mt = toneless(member);
  if (mt && anchor.some((a) => toneless(a) === mt)) return "tone";
  return "diverged";
}

const FIT_LABEL = {
  same: "same reading",
  tone: "tone differs",
  diverged: "reading diverged",
} as const;

export default function PhoneticDetail({ loaderData }: Route.ComponentProps) {
  const { meta, byLevel, total } = loaderData;
  const reading = meta.pinyin[0];

  return (
    <DetailShell back={{ to: `/hsk/${formatLevels(LEVELS)}/phonetics`, label: "All phonetics" }}>
      <div className="flex flex-wrap items-center gap-5">
        <span className="han text-7xl leading-none">{meta.component}</span>
        <div>
          <h1 className="text-xl text-ink">
            Sound component
            {reading && <span className="ml-2 text-ink-2">{reading}</span>}
          </h1>
          {meta.anchor !== meta.component && (
            <p className="mt-1 text-sm text-ink-2">
              Component form of{" "}
              {meta.hanzi && meta.hanzi === meta.anchor ? (
                <Link to={`/hanzi/${encodeURIComponent(meta.anchor)}`} className="text-accent">
                  <span className="han">{meta.anchor}</span>
                </Link>
              ) : (
                <span className="han">{meta.anchor}</span>
              )}
              {reading && <> {reading}</>}
              {meta.meaning && <> · {meta.meaning}</>}
            </p>
          )}
          {meta.anchor === meta.component && (meta.meaning || meta.hanzi) && (
            <p className="mt-1 text-sm text-ink-2">
              {meta.hanzi ? (
                <Link to={`/hanzi/${encodeURIComponent(meta.hanzi)}`} className="text-accent">
                  <span className="han">{meta.hanzi}</span>
                </Link>
              ) : (
                <span className="han">{meta.component}</span>
              )}
              {reading && <> {reading}</>}
              {meta.meaning && <> · {meta.meaning}</>}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            <Chip tone="quiet">
              {total} character{total === 1 ? "" : "s"} in HSK 1–9
            </Chip>
            {meta.radical && (
              <Link
                to={`/radicals/${encodeURIComponent(meta.radical.char)}`}
                className="text-accent"
              >
                as radical {meta.radical.display} {meta.radical.gloss} · Kangxi #
                {meta.radical.number}
              </Link>
            )}
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-2">
        This component marks <em>sound</em>, not meaning. It suggested a pronunciation when the
        character was formed. In modern Mandarin the match may be exact, differ only by tone, or
        have diverged. The members’ English glosses being unrelated is the point.
      </p>

      <div className="mt-8 space-y-6">
        {byLevel.map(({ level, members }) => (
          <Section
            key={level}
            title={`HSK ${levelLabel(level as Level)}`}
            aside={<span className="text-[11px] text-ink-3">{members.length}</span>}
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              {members.map((m) => {
                const fit = meta.pinyin.length ? pinyinFit(meta.pinyin, m.pinyin[0] ?? "") : null;
                return (
                  <Link
                    key={m.char}
                    to={`/hanzi/${encodeURIComponent(m.char)}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:border-accent"
                  >
                    <span className="han w-10 shrink-0 text-center text-3xl">{m.char}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-ink-2">{m.pinyin[0]}</span>
                      <span className="block truncate text-[11px] text-ink-3">{m.meanings[0]}</span>
                    </span>
                    {m.semantic && (
                      <span className="shrink-0 text-[11px] text-ink-3" title="meaning component">
                        义 <span className="han">{m.semantic}</span>
                      </span>
                    )}
                    {fit && (
                      <span className="shrink-0 text-[10px] text-ink-3">{FIT_LABEL[fit]}</span>
                    )}
                    <StatusDot status={m.status} />
                  </Link>
                );
              })}
            </div>
          </Section>
        ))}
      </div>
    </DetailShell>
  );
}
