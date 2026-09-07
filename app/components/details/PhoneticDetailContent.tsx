import { DetailLink } from "~/components/DetailLink";
import { levelLabel } from "~/lib/levels";
import { toneless } from "~/lib/pinyin";
import { Chip, Section, StatusDot } from "~/components/ui";
import type { PhoneticDetailData } from "~/lib/detail-data";
import type { Level } from "~/lib/types";

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

export function PhoneticDetailContent({ data }: { data: PhoneticDetailData }) {
  const { meta, byLevel, total } = data;
  const reading = meta.pinyin[0];

  return (
    <>
      <div className="ui-card flex flex-wrap items-center gap-5 px-4 py-5 sm:px-6">
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
                <DetailLink to={`/hanzi/${encodeURIComponent(meta.anchor)}`} className="text-accent">
                  <span className="han">{meta.anchor}</span>
                </DetailLink>
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
                <DetailLink to={`/hanzi/${encodeURIComponent(meta.hanzi)}`} className="text-accent">
                  <span className="han">{meta.hanzi}</span>
                </DetailLink>
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
              <DetailLink
                to={`/radicals/${encodeURIComponent(meta.radical.char)}`}
                className="text-accent"
              >
                as radical {meta.radical.display} {meta.radical.gloss} · Kangxi #
                {meta.radical.number}
              </DetailLink>
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
            aside={<span className="text-xs text-ink-3">{members.length}</span>}
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              {members.map((m) => {
                const fit = meta.pinyin.length ? pinyinFit(meta.pinyin, m.pinyin[0] ?? "") : null;
                return (
                  <DetailLink
                    key={m.char}
                    to={`/hanzi/${encodeURIComponent(m.char)}`}
                    className="ui-card ui-card-interactive flex min-h-16 flex-wrap items-center gap-2 px-3 py-2"
                  >
                    <span className="han w-10 shrink-0 text-center text-3xl">{m.char}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-ink-2">{m.pinyin[0]}</span>
                      <span className="block truncate text-xs text-ink-3">{m.meanings[0]}</span>
                    </span>
                    {m.semantic && (
                      <span className="shrink-0 text-xs text-ink-3" title="meaning component">
                        义 <span className="han">{m.semantic}</span>
                      </span>
                    )}
                    {fit && <span className="shrink-0 text-xs text-ink-3">{FIT_LABEL[fit]}</span>}
                    <StatusDot status={m.status} />
                  </DetailLink>
                );
              })}
            </div>
          </Section>
        ))}
      </div>
    </>
  );
}
