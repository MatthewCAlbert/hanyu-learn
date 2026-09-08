import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { loadCompareCatalog } from "~/lib/detail-data";
import { browseOriginFromLocation } from "~/lib/navigation";
import {
  browseSearchEmpty,
  containsHanzi,
  hanziCount,
  isExactCorpusEntry,
  shouldSuggestTranslate,
  translateHref,
} from "~/lib/translate";

export function TranslateSearchHint({
  query,
  shown,
}: {
  query: string;
  shown: {
    hanzi: number;
    words: number;
    topics: number;
    radicals: number;
    phonetics: number;
    grammar: number;
  };
}) {
  const location = useLocation();
  const [offer, setOffer] = useState(false);
  const empty = browseSearchEmpty(shown);
  const needle = query.trim();
  const eligible =
    Boolean(needle) && (empty || (containsHanzi(query) && hanziCount(query) >= 2));

  useEffect(() => {
    if (!eligible) {
      setOffer(false);
      return;
    }
    if (empty && !containsHanzi(needle)) {
      setOffer(true);
      return;
    }
    let cancelled = false;
    setOffer(false);
    void loadCompareCatalog().then((catalog) => {
      if (cancelled) return;
      setOffer(shouldSuggestTranslate(query, empty, isExactCorpusEntry(catalog, query)));
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, empty, query, needle]);

  if (!offer) return null;
  const origin = browseOriginFromLocation(location);
  return (
    <div className="ui-card absolute inset-x-0 top-[calc(100%+4px)] z-30 py-1 shadow-lg">
      <Link
        to={translateHref(query)}
        state={origin}
        className="ui-touch flex w-full items-center px-3 text-left text-sm text-ink hover:bg-sunk"
      >
        {empty ? "Search in Translate" : "Analyze this text"}
        <span className="ml-auto shrink-0 text-xs text-ink-3">Translate</span>
      </Link>
    </div>
  );
}

const EMPTY_BOX =
  "rounded-xl border border-dashed border-line bg-surface/50 px-4 py-12 text-center text-sm text-ink-3";

/** Empty browse list: when a query hit nothing, send the reader to Translate. */
export function CatalogEmpty({ fallback }: { fallback: string }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  if (!q) {
    return <p className={EMPTY_BOX}>{fallback}</p>;
  }
  const origin = browseOriginFromLocation(location);
  return (
    <div className={EMPTY_BOX}>
      <p>Nothing in this collection matches.</p>
      <Link
        to={translateHref(q)}
        state={origin}
        className="ui-touch mt-3 inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-accent hover:text-accent"
      >
        Search in Translate
      </Link>
    </div>
  );
}
