import { Link } from "react-router";
import clsx from "clsx";
import { IDC_LABEL, parseIds, type IdsNode } from "~/lib/ids";
import type { Etymology } from "~/lib/types";

/**
 * Renders the IDS decomposition as a tree of clickable component chips.
 *
 * The semantic component is filled in accent and the phonetic outlined, so the
 * answer to "which half means, which half sounds" is visible at a glance —
 * this is the payoff of the whole app.
 */
export function Decomposition({
  decomposition,
  etymology,
  glosses,
  hrefs = {},
}: {
  decomposition: string;
  etymology: Etymology | null;
  glosses: Record<string, string>;
  hrefs?: Record<string, string | null>;
}) {
  const tree = parseIds(decomposition);
  if (!tree || tree.kind === "unknown" || tree.kind === "leaf") {
    return (
      <p className="text-sm text-ink-3">
        Atomic — no recorded decomposition. This character is a unit, not a combination.
      </p>
    );
  }
  return <Node node={tree} etymology={etymology} glosses={glosses} hrefs={hrefs} depth={0} />;
}

function Node({
  node,
  etymology,
  glosses,
  hrefs,
  depth,
}: {
  node: IdsNode;
  etymology: Etymology | null;
  glosses: Record<string, string>;
  hrefs: Record<string, string | null>;
  depth: number;
}) {
  if (node.kind === "unknown") {
    return (
      <span className="rounded-md border border-dashed border-line px-3 py-2 text-ink-3">?</span>
    );
  }

  if (node.kind === "leaf") {
    const role =
      etymology?.semantic === node.char && etymology.semanticVisible !== false
        ? "semantic"
        : etymology?.phonetic === node.char && etymology.phoneticVisible !== false
          ? "phonetic"
          : null;
    const gloss = glosses[node.char];
    const href = hrefs[node.char];
    const className = clsx(
      "group flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors",
      role === "semantic" && "border-accent bg-accent-soft",
      role === "phonetic" && "border-accent border-dashed",
      !role && "border-line bg-surface",
      href && "hover:border-accent",
    );
    const inner = (
      <>
        <span className={clsx("han text-3xl", role === "semantic" ? "text-accent" : "text-ink")}>
          {node.char}
        </span>
        {gloss && <span className="max-w-20 truncate text-[10px] text-ink-3">{gloss}</span>}
        {role && (
          <span className="text-[10px] tracking-wide text-accent">
            {role === "semantic" ? "meaning" : "sound"}
          </span>
        )}
      </>
    );
    if (href) {
      return (
        <Link to={href} className={className}>
          {inner}
        </Link>
      );
    }
    return <div className={className}>{inner}</div>;
  }

  const vertical = node.idc === "⿱" || node.idc === "⿳";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={clsx(
          "flex items-center gap-2 rounded-lg",
          vertical ? "flex-col" : "flex-row",
          depth > 0 && "border border-line/60 border-dashed p-2",
        )}
      >
        {node.children.map((child, i) => (
          <Node
            key={i}
            node={child}
            etymology={etymology}
            glosses={glosses}
            hrefs={hrefs}
            depth={depth + 1}
          />
        ))}
      </div>
      {depth === 0 && (
        <span className="text-[11px] text-ink-3">
          <span className="han">{node.idc}</span> {IDC_LABEL[node.idc]}
        </span>
      )}
    </div>
  );
}
