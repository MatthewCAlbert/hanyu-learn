import type { Radical } from "./types";

/**
 * Resolve a written form to a Kangxi radical only when the form *is* that
 * radical: the canonical character, the group's display form, or a recorded
 * variant. Indexing a character under a radical (申 → 田) is not enough.
 */
export function matchRadical(form: string, radicals: Radical[]): Radical | undefined {
  return radicals.find(
    (r) =>
      r.char === form || r.canonical === form || r.display === form || r.variants.includes(form),
  );
}
