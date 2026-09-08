import { useState } from "react";
import { Popover } from "radix-ui";
import { GLOSSARY, type GlossaryKey, glossaryAriaLabel } from "~/lib/lexical-glossary";

export function GlossaryTerm({
  term,
  children,
}: {
  term: GlossaryKey;
  children?: React.ReactNode;
}) {
  const entry = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const label = children ?? entry.label;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="ui-touch inline-flex max-w-full shrink-0 items-center rounded-full px-2.5 text-xs leading-4 text-ink-2 underline decoration-dotted decoration-ink-3 underline-offset-2 hover:text-accent hover:decoration-accent"
          aria-expanded={open}
          aria-label={glossaryAriaLabel(term)}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[min(calc(100vw-2rem),18rem)] rounded-xl border border-line bg-paper px-3 py-2 text-left text-xs leading-5 text-ink-2 shadow-lg outline-none"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-medium text-ink">{entry.label}</p>
          <p className="mt-0.5">{entry.definition}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function GlossaryLegend({ terms }: { terms: GlossaryKey[] }) {
  if (terms.length === 0) return null;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-3">
      <span className="sr-only">Term meanings (also available on each label):</span>
      {terms.map((term) => (
        <GlossaryTerm key={term} term={term} />
      ))}
    </p>
  );
}
