import { Link } from "react-router";
import { compareHref, type EntryRef } from "~/lib/compare";

export function CompareVsButton({ entry }: { entry: EntryRef }) {
  return (
    <Link
      to={compareHref({ left: entry })}
      aria-label="Compare"
      title="Compare with another entry"
      className="ui-touch inline-flex shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium tracking-wide text-ink-2 transition-colors hover:text-accent"
    >
      VS
    </Link>
  );
}
