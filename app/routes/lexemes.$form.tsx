import { useMemo } from "react";
import type { Route } from "./+types/lexemes.$form";
import { loadLexemeDetail } from "~/lib/detail-data";
import { DetailShell } from "~/components/DetailShell";
import { LexemeDetailContent } from "~/components/details/LexemeDetailContent";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { serializeLexemeContext } from "~/lib/ai/context";
import { isHanziLexeme } from "~/lib/lexical";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  const l = loaderData.lexeme;
  return [{ title: `${l.form} ${l.pinyin} — Mandarin` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const form = decodeURIComponent(params.form);
  const page = await loadLexemeDetail(form);
  if (!page) throw new Response(`${form} is not a spoken/chat lexeme`, { status: 404 });
  return page;
}
clientLoader.hydrate = true as const;

export default function LexemeDetail({ loaderData }: Route.ComponentProps) {
  const { lexeme: l } = loaderData;
  const context = useMemo(() => serializeLexemeContext(loaderData), [loaderData]);
  const extraTab = isHanziLexeme(l.form) ? "hanzi" : "words";
  return (
    <>
      <PageContextBridge context={context} />
      <DetailShell
        current={<span className="han">{l.form}</span>}
        fallback={{
          to: `/hsk/extra/${extraTab}`,
          label: extraTab === "hanzi" ? "Extra Hanzi" : "Extra Words",
        }}
      >
        <LexemeDetailContent data={loaderData} />
      </DetailShell>
    </>
  );
}
