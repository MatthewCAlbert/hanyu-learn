import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
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
  };
}) {
  const location = useLocation();
  const [offer, setOffer] = useState(false);
  const empty = browseSearchEmpty(shown);
  const eligible = containsHanzi(query) && (empty || hanziCount(query) >= 2);

  useEffect(() => {
    if (!eligible) {
      setOffer(false);
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
  }, [eligible, empty, query]);

  if (!offer) return null;
  const origin = browseOriginFromLocation(location);
  return (
    <div className="ui-card absolute inset-x-0 top-[calc(100%+4px)] z-30 py-1 shadow-lg">
      <Link
        to={translateHref(query)}
        state={origin}
        className="ui-touch flex w-full items-center px-3 text-left text-sm text-ink hover:bg-sunk"
      >
        Analyze this text
        <span className="ml-auto shrink-0 text-xs text-ink-3">Translate</span>
      </Link>
    </div>
  );
}
