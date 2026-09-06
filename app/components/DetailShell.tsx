import { Link } from "react-router";

/** Shared frame for the three detail pages. */
export function DetailShell({
  back,
  children,
}: {
  back: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 px-4 py-2.5 backdrop-blur lg:px-6">
        <Link to={back.to} className="text-sm text-ink-2 transition-colors hover:text-accent">
          ← {back.label}
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-6">{children}</main>
    </div>
  );
}

/** Authored prose. Kept deliberately plain — it is read, not skimmed. */
export function Prose({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-2">
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
