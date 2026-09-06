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
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] leading-4 whitespace-nowrap",
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
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">{title}</h2>
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
        "han inline-flex items-center justify-center rounded-md border border-line bg-surface text-ink transition-colors hover:border-accent hover:text-accent",
        size === "sm" && "size-8 text-lg",
        size === "md" && "size-11 text-2xl",
        size === "lg" && "size-16 text-4xl",
        className,
      )}
    >
      {char}
    </Link>
  );
}

/** Renders a sentence with every occurrence of `highlight` picked out. */
export function Highlighted({ text, highlight }: { text: string; highlight: string }) {
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
    <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-3">
      {children}
    </p>
  );
}
