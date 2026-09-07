import { Link } from "react-router";
import type { Route } from "./+types/level.phonetics";
import { matchesPhonetic, phoneticsAtLevels } from "~/lib/catalog";
import { getHanziIndexes, getPhonetics } from "~/lib/data.client";
import { parseLevels } from "~/lib/levels";
import { readFilters } from "~/lib/filters";
import { Empty } from "~/components/ui";
import { Toolbar } from "./level.hanzi";

const PREVIEW = 6;

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const levels = parseLevels(params.level);
  const { q } = readFilters(new URL(request.url).searchParams);
  const [phonetics, hanzi] = await Promise.all([getPhonetics(), getHanziIndexes(levels)]);
  const series = phoneticsAtLevels(phonetics, hanzi, levels).filter((row) =>
    matchesPhonetic(q, row),
  );
  return { series, total: series.length };
}
clientLoader.hydrate = true as const;

export default function LevelPhonetics({ loaderData }: Route.ComponentProps) {
  const { series, total } = loaderData;
  return (
    <>
      <Toolbar total={total} noun="phonetic" />
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-3">
        These are sound families, not dictionary radicals. A component here suggested a
        pronunciation when the character was formed; modern Mandarin may match exactly, differ only
        by tone, or have diverged.
      </p>
      {total === 0 && <Empty>No phonetic series matches that search.</Empty>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {series.map(({ meta, members }) => {
          const reading = meta.pinyin[0];
          const preview = members.slice(0, PREVIEW);
          return (
            <Link
              key={meta.component}
              to={`/phonetic/${encodeURIComponent(meta.component)}`}
              className="ui-card ui-card-interactive group flex min-h-16 items-center gap-3 px-3.5 py-2.5"
            >
              <span className="han w-8 shrink-0 text-center text-2xl group-hover:text-accent">
                {meta.component}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">
                  {meta.anchor !== meta.component && (
                    <span className="han text-ink-2">{meta.anchor} </span>
                  )}
                  {reading ?? <span className="text-ink-3">no standalone reading</span>}
                  {meta.meaning && <span className="text-ink-3"> · {meta.meaning}</span>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">
                  <span className="han">{preview.map((m) => m.char).join(" ")}</span>
                  {members.length > PREVIEW && <> +{members.length - PREVIEW}</>}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-3">{members.length}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
