import { Link, useLocation, useNavigate } from "react-router";
import { CreditsFooter } from "./CreditsFooter";
import { canHistoryBack, resolveBrowseOrigin } from "~/lib/navigation";

/** Shared frame for the detail pages. */
export function DetailShell({
  current,
  fallback,
  action,
  children,
}: {
  current: React.ReactNode;
  fallback: { to: string; label: string };
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const parent = resolveBrowseOrigin(location.state, fallback);
  const historyBack = canHistoryBack(location.key);
  const backClass =
    "ui-touch inline-flex shrink-0 items-center rounded-lg px-2 text-sm font-medium text-ink-2 transition-colors hover:text-accent";

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-3 lg:px-6">
          {historyBack ? (
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className={backClass}>
              <span aria-hidden className="mr-2 text-lg">
                ←
              </span>
              Back
            </button>
          ) : (
            <Link to={parent.to} aria-label="Back" className={backClass}>
              <span aria-hidden className="mr-2 text-lg">
                ←
              </span>
              Back
            </Link>
          )}
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              <li className="min-w-0">
                <Link
                  to={parent.to}
                  title={parent.label}
                  className="ui-touch inline-flex min-w-0 max-w-full items-center truncate rounded-lg text-ink-2 transition-colors hover:text-accent"
                >
                  {parent.label}
                </Link>
              </li>
              <li aria-hidden className="shrink-0 text-ink-3">
                /
              </li>
              <li className="min-w-0 truncate font-medium text-ink" aria-current="page">
                {current}
              </li>
            </ol>
          </nav>
          {action}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
      <CreditsFooter />
    </div>
  );
}

/** Authored prose. Kept deliberately plain — it is read, not skimmed. */
export function Prose({ children }: { children: string }) {
  return (
    <div className="max-w-3xl space-y-3 text-[15px] leading-7 text-ink-2">
      {children
        .split(/\n{2,}/)
        .filter((p) => p.trim() && !p.trim().startsWith("<!--"))
        .map((p, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: inline(p) }} />
        ))}
    </div>
  );
}

const HANZI_ONLY = /^[一-鿿]+$/u;

/**
 * `[[target]]` resolves by shape: a single character is a hanzi, several
 * characters a word, anything else (kebab-case) a topic. Cheap, and it means
 * authors never have to write a path.
 */
function wikiLink(target: string): string {
  const t = target.trim();
  const href = HANZI_ONLY.test(t)
    ? `/${[...t].length === 1 ? "hanzi" : "words"}/${encodeURIComponent(t)}`
    : `/topics/${encodeURIComponent(t)}`;
  const label = HANZI_ONLY.test(t) ? `<span class="han">${t}</span>` : t.replace(/-/g, " ");
  return `<a href="${href}" class="text-accent underline decoration-dotted underline-offset-2">${label}</a>`;
}

/** Minimal inline markdown: **bold**, *italic*, `code`, [[links]]. Escapes first. */
function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\[\[([^\]]+?)\]\]/g, (_, t: string) => wikiLink(t))
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-medium text-ink">$1</strong>')
    .replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em class="italic">$2</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-sunk px-1 text-[0.9em]">$1</code>')
    .replace(/\n/g, " ");
}
