import { DetailLink } from "~/components/DetailLink";
import { DoubledChip, Highlighted, StatusDot } from "~/components/ui";
import { lexemeHref, SPOKEN_SECTION } from "~/lib/lexical";
import type { Lexeme } from "~/lib/types";
import type { Match } from "~/lib/filters";
import { glossFor } from "~/lib/filters";

export function LexemeBrowseSection({
  items,
  layout,
}: {
  items: { lexeme: Lexeme; match: Match | null }[];
  layout: "word" | "hanzi" | "hanzi-table";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="sticky top-(--app-header-height) z-10 -mx-1 mb-2 flex items-baseline gap-2 border-b border-line/70 bg-paper/95 px-1 py-2 backdrop-blur">
        <span className="text-sm font-medium text-ink">{SPOKEN_SECTION}</span>
        <span className="text-xs text-ink-3">{items.length}</span>
      </div>
      {layout === "hanzi-table" ? (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="min-w-136 w-full text-sm">
            <tbody>
              {items.map(({ lexeme, match }) => {
                const { text, at } = glossFor(lexeme.meanings, match, 2);
                return (
                  <tr key={lexeme.form} className="border-b border-line/60 hover:bg-sunk">
                    <td className="w-12 py-1.5">
                      <DetailLink
                        to={lexemeHref(lexeme.form)}
                        className="han text-2xl hover:text-accent"
                      >
                        {lexeme.form}
                      </DetailLink>
                    </td>
                    <td className="w-28 text-ink-2">{lexeme.pinyin}</td>
                    <td className="truncate text-ink-2" title={text}>
                      <Highlighted text={text} at={at} />
                    </td>
                    <td className="w-28 text-right text-[11px] text-ink-3">
                      <span className="inline-flex items-center justify-end gap-1">
                        {match?.redup && <DoubledChip />}
                        <span>not on HSK</span>
                      </span>
                    </td>
                    <td className="w-8 text-right">
                      <StatusDot status={lexeme.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : layout === "hanzi" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {items.map(({ lexeme, match }) => {
            const { text, at } = glossFor(lexeme.meanings, match, 2);
            return (
              <DetailLink
                key={lexeme.form}
                to={lexemeHref(lexeme.form)}
                className="ui-card ui-card-interactive group flex min-h-28 flex-col items-center justify-center px-2 py-3"
              >
                <span className="han text-3xl group-hover:text-accent">{lexeme.form}</span>
                <span className="mt-1 max-w-full truncate text-xs text-ink-2">{lexeme.pinyin}</span>
                <span title={text} className="max-w-full truncate text-xs text-ink-3">
                  <Highlighted text={text} at={at} />
                </span>
                <span className="mt-0.5 flex items-center gap-1">
                  <span className="text-xs text-ink-3">not on HSK</span>
                  {match?.redup && <DoubledChip />}
                  <StatusDot status={lexeme.status} />
                </span>
              </DetailLink>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ lexeme, match }) => {
            const { text, at } = glossFor(lexeme.meanings, match, 2);
            return (
              <DetailLink
                key={lexeme.form}
                to={lexemeHref(lexeme.form)}
                className="ui-card ui-card-interactive group flex min-h-24 min-w-0 flex-col px-3.5 py-3"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="han shrink-0 text-2xl group-hover:text-accent">{lexeme.form}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{lexeme.pinyin}</span>
                  <span className="shrink-0 text-xs text-ink-3">not on HSK</span>
                  {match?.redup && <DoubledChip />}
                  <StatusDot status={lexeme.status} />
                </div>
                <span title={text} className="mt-0.5 truncate text-xs text-ink-2">
                  <Highlighted text={text} at={at} />
                </span>
              </DetailLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
