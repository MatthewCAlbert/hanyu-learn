import { Link, useLocation } from "react-router";
import { browseOriginFromLocation } from "~/lib/navigation";
import { songsHref } from "~/lib/song";
import { translateHref } from "~/lib/translate";

const itemClass =
  "ui-touch flex w-full items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink";
const desktopClass =
  "ui-touch inline-flex items-center justify-center rounded-xl px-2.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink";

export function WorkspaceNav() {
  const location = useLocation();
  const origin = browseOriginFromLocation(location);

  return (
    <>
      <details className="relative lg:hidden">
        <summary className="ui-touch inline-flex list-none items-center justify-center rounded-xl px-2.5 text-sm font-medium text-ink-2 marker:content-none hover:text-ink [&::-webkit-details-marker]:hidden">
          Study
        </summary>
        <div className="absolute right-0 z-30 mt-1 min-w-40 rounded-xl border border-line bg-paper p-1 shadow-xl">
          <Link to={translateHref("")} state={origin} className={itemClass}>
            Translate
          </Link>
          <Link to={songsHref()} state={origin} className={itemClass}>
            Songs
          </Link>
        </div>
      </details>
      <nav aria-label="Study workspaces" className="hidden items-center gap-1 lg:flex">
        <Link to={translateHref("")} state={origin} className={desktopClass}>
          Translate
        </Link>
        <Link to={songsHref()} state={origin} className={desktopClass}>
          Songs
        </Link>
      </nav>
    </>
  );
}
