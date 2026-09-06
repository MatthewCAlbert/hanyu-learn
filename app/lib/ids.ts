/**
 * Ideographic Description Sequence parsing.
 *
 * makemeahanzi gives decompositions as prefix-notation IDS strings, e.g.
 *   妈 -> "⿰女马"           (left-right: 女, 马)
 *   爱 -> "⿱⿱爫冖友"        (nested)
 *   人 -> "？"               (unknown / atomic)
 */

/** IDC (Ideographic Description Character) -> operand count. */
export const IDC: Record<string, 2 | 3> = {
  "⿰": 2, // left to right
  "⿱": 2, // above to below
  "⿲": 3, // left to middle to right
  "⿳": 3, // above to middle to below
  "⿴": 2, // full surround
  "⿵": 2, // surround from above
  "⿶": 2, // surround from below
  "⿷": 2, // surround from left
  "⿸": 2, // surround from upper left
  "⿹": 2, // surround from upper right
  "⿺": 2, // surround from lower left
  "⿻": 2, // overlaid
};

export const IDC_LABEL: Record<string, string> = {
  "⿰": "left / right",
  "⿱": "top / bottom",
  "⿲": "left / middle / right",
  "⿳": "top / middle / bottom",
  "⿴": "enclosed",
  "⿵": "surrounded from above",
  "⿶": "surrounded from below",
  "⿷": "surrounded from the left",
  "⿸": "upper-left enclosure",
  "⿹": "upper-right enclosure",
  "⿺": "lower-left enclosure",
  "⿻": "overlaid",
};

export type IdsNode =
  | { kind: "leaf"; char: string }
  | { kind: "unknown" }
  | { kind: "compound"; idc: string; children: IdsNode[] };

/**
 * Parse a prefix-notation IDS string into a tree.
 * Returns null if the string is malformed or has trailing input.
 */
export function parseIds(ids: string): IdsNode | null {
  const chars = [...ids];
  let i = 0;

  function node(): IdsNode | null {
    const c = chars[i];
    if (c === undefined) return null;
    i += 1;
    if (c === "？" || c === "?") return { kind: "unknown" };
    const arity = IDC[c];
    if (arity === undefined) return { kind: "leaf", char: c };
    const children: IdsNode[] = [];
    for (let n = 0; n < arity; n += 1) {
      const child = node();
      if (child === null) return null;
      children.push(child);
    }
    return { kind: "compound", idc: c, children };
  }

  const tree = node();
  if (tree === null || i !== chars.length) return null;
  return tree;
}

/** Every distinct character appearing as a leaf, in reading order. */
export function idsLeaves(tree: IdsNode): string[] {
  const out: string[] = [];
  const walk = (n: IdsNode) => {
    if (n.kind === "leaf") out.push(n.char);
    else if (n.kind === "compound") n.children.forEach(walk);
  };
  walk(tree);
  return out;
}

/** Serialize back to prefix notation. Round-trips `parseIds`. */
export function idsToString(tree: IdsNode): string {
  if (tree.kind === "unknown") return "？";
  if (tree.kind === "leaf") return tree.char;
  return tree.idc + tree.children.map(idsToString).join("");
}

/** True when the decomposition tells us nothing (atomic or unrecorded). */
export function isAtomic(ids: string): boolean {
  return ids === "？" || ids === "" || [...ids].length === 1;
}
