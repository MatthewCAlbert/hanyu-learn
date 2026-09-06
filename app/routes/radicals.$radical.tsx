import { Link } from "react-router";
import type { Route } from "./+types/radicals.$radical";
import { getHanziIndexes, getRadical } from "~/lib/data.client";
import { LEVELS, formatLevels } from "~/lib/levels";
import { Chip, Section, StatusDot } from "~/components/ui";
import { DetailShell } from "~/components/DetailShell";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `Radical ${loaderData.radical.char} — ${loaderData.radical.gloss}` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const char = decodeURIComponent(params.radical);
  const radical = await getRadical(char);
  if (!radical) throw new Response(`No radical ${char} in HSK 1–9`, { status: 404 });

  const HANZI = await getHanziIndexes(LEVELS);
  const members = HANZI.filter((h) => h.radicalCanonical === radical.char).map((h) => ({
    char: h.char,
    written: h.radical,
    pinyin: h.pinyin[0] ?? "",
    meaning: h.meanings[0] ?? "",
    level: h.level,
    status: h.status,
    phonetic: h.phonetic,
  }));

  const byLevel = LEVELS.map((level) => ({
    level,
    members: members.filter((m) => m.level === level),
  })).filter((g) => g.members.length > 0);

  return { radical, byLevel, total: members.length };
}
clientLoader.hydrate = true as const;

export default function RadicalDetail({ loaderData }: Route.ComponentProps) {
  const { radical: r, byLevel, total } = loaderData;

  return (
    <DetailShell back={{ to: `/hsk/${formatLevels(LEVELS)}/radicals`, label: "All radicals" }}>
      <div className="flex flex-wrap items-center gap-5">
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
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {byLevel.map(({ level, members }) => (
          <Section key={level} title={`HSK ${level}`} aside={<span className="text-[11px] text-ink-3">{members.length}</span>}>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {members.map((m) => (
                <Link
                  key={m.char}
                  to={`/hanzi/${encodeURIComponent(m.char)}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:border-accent"
                >
                  <span className="han w-10 shrink-0 text-center text-3xl">{m.char}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-2">{m.pinyin}</span>
                    <span className="block truncate text-[11px] text-ink-3">{m.meaning}</span>
                  </span>
                  {m.phonetic && (
                    <span className="shrink-0 text-[11px] text-ink-3" title="phonetic component">
                      声 <span className="han">{m.phonetic}</span>
                    </span>
                  )}
                  <StatusDot status={m.status} />
                </Link>
              ))}
            </div>
          </Section>
        ))}
      </div>
    </DetailShell>
  );
}
