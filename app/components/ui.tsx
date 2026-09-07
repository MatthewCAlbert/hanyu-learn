import { Link } from "react-router";
import clsx from "clsx";
import type { Status } from "~/lib/types";

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "quiet";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs leading-4 whitespace-nowrap",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "neutral" && "bg-sunk text-ink-2",
        tone === "quiet" && "text-ink-3 ring-1 ring-line ring-inset",
      )}
    >
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  reviewed: "reviewed",
  drafted: "drafted",
  stub: "not yet written",
};

export function StatusDot({ status }: { status: Status }) {
  return (
    <span
      title={STATUS_LABEL[status]}
      aria-label={STATUS_LABEL[status]}
      className={clsx(
        "inline-block size-1.5 shrink-0 rounded-full",
        status === "reviewed" && "bg-accent",
        status === "drafted" && "bg-ink-3",
        status === "stub" && "ring-1 ring-line ring-inset",
      )}
    />
  );
}

/** Section heading used across detail pages. */
export function Section({
  title,
  aside,
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="ui-eyebrow">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function HanziLink({
  char,
  size = "md",
  className,
}: {
  char: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Link
      to={`/hanzi/${encodeURIComponent(char)}`}
      className={clsx(
        "han inline-flex items-center justify-center rounded-lg border border-line bg-surface text-ink transition-colors hover:border-accent hover:text-accent",
        size === "sm" && "size-11 text-xl",
        size === "md" && "size-11 text-2xl",
        size === "lg" && "size-16 text-4xl",
        className,
      )}
    >
      {char}
    </Link>
  );
}

/**
 * Picks part of a string out in the accent colour.
 *
 * Two forms: `highlight` marks every occurrence of a substring (sentences),
 * while `at` marks one already-located `[start, end)` slice. Search uses `at`
 * because the loader knows the exact hit — including when the reader typed
 * "WAIT" and the gloss reads "to wait".
 */
export function Highlighted({
  text,
  highlight,
  at,
}: {
  text: string;
  highlight?: string;
  at?: [number, number] | null;
}) {
  if (at) {
    return (
      <>
        {text.slice(0, at[0])}
        <span className="text-accent">{text.slice(at[0], at[1])}</span>
        {text.slice(at[1])}
      </>
    );
  }
  if (!highlight) return <>{text}</>;
  const parts = text.split(highlight);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="text-accent">{highlight}</span>}
        </span>
      ))}
    </>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-12 text-center text-sm text-ink-3">
      {children}
    </p>
  );
}
