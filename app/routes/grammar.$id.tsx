import { useMemo } from "react";
import type { Route } from "./+types/grammar.$id";
import { loadGrammarDetail } from "~/lib/detail-data";
import { defaultBrowseFallback } from "~/lib/navigation";
import { DetailShell } from "~/components/DetailShell";
import { GrammarDetailContent } from "~/components/details/GrammarDetailContent";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { serializeGrammarContext } from "~/lib/ai/context";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.lesson.pattern} — ${loaderData.lesson.title}` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const data = await loadGrammarDetail(params.id);
  if (!data) throw new Response(`No grammar lesson “${params.id}”`, { status: 404 });
  return data;
}
clientLoader.hydrate = true as const;

export default function GrammarDetail({ loaderData }: Route.ComponentProps) {
  const context = useMemo(() => serializeGrammarContext(loaderData), [loaderData]);
  return (
    <>
      <PageContextBridge context={context} />
      <DetailShell
        current={loaderData.lesson.pattern}
        fallback={defaultBrowseFallback("grammar")}
      >
        <GrammarDetailContent data={loaderData} />
      </DetailShell>
    </>
  );
}
