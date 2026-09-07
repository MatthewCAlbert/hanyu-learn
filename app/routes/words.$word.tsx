import { useMemo } from "react";
import type { Route } from "./+types/words.$word";
import { loadWordDetail } from "~/lib/detail-data";
import { DetailShell } from "~/components/DetailShell";
import { WordDetailContent } from "~/components/details/WordDetailContent";
import { CompareVsButton } from "~/components/CompareVsButton";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { serializeWordContext } from "~/lib/ai/context";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.word.word} ${loaderData.word.pinyin} — Mandarin` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const text = decodeURIComponent(params.word);
  const page = await loadWordDetail(text);
  if (!page) throw new Response(`${text} is not in the corpus`, { status: 404 });
  return page;
}
clientLoader.hydrate = true as const;

export default function WordDetail({ loaderData }: Route.ComponentProps) {
  const { word: w } = loaderData;
  const context = useMemo(() => serializeWordContext(loaderData), [loaderData]);
  return (
    <>
      <PageContextBridge context={context} />
      <DetailShell
        current={<span className="han">{w.word}</span>}
        fallback={{
          to: w.extra ? "/hsk/extra/words" : `/hsk/${w.level}/words`,
          label: w.extra ? "Extra Words" : `HSK ${w.level} Words`,
        }}
        action={<CompareVsButton entry={{ kind: "word", id: w.word }} />}
      >
        <WordDetailContent data={loaderData} />
      </DetailShell>
    </>
  );
}
