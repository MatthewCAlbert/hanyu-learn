import type { GrammarIndex, GrammarLesson, Level } from "./types";

/** Lowercased search blob so the curriculum tab can match without re-joining prose. */
export function grammarHaystack(
  lesson: Pick<
    GrammarLesson,
    "id" | "title" | "pattern" | "hanzi" | "words" | "examples" | "patternNotes" | "usage" | "notes"
  >,
): string {
  return [
    lesson.id,
    lesson.title,
    lesson.pattern,
    lesson.hanzi.join(" "),
    lesson.words.join(" "),
    ...lesson.examples.flatMap((e) => [e.cmn, e.eng]),
    lesson.patternNotes,
    lesson.usage,
    lesson.notes,
  ]
    .filter((s): s is string => Boolean(s))
    .join("\n")
    .toLowerCase();
}

export function matchesGrammar(q: string, g: Pick<GrammarIndex, "haystack">): boolean {
  if (!q) return true;
  return g.haystack.includes(q.trim().toLowerCase());
}

/** Lessons in the selected HSK bands, in curriculum order, never merged across levels. */
export function grammarAtLevels(lessons: GrammarIndex[], levels: Level[]): GrammarIndex[] {
  const wanted = new Set(levels);
  return lessons
    .filter((g) => wanted.has(g.level))
    .sort((a, b) => a.level - b.level || a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * First cycle in the prerequisite graph, or null. Unknown ids are ignored —
 * `check:content` reports those separately.
 */
export function findGrammarCycle(
  lessons: { id: string; prerequisites: string[] }[],
): string[] | null {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (id: string): string[] | null => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id];
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    for (const pre of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(pre)) continue;
      const cycle = dfs(pre);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const lesson of lessons) {
    const cycle = dfs(lesson.id);
    if (cycle) return cycle;
  }
  return null;
}

export function toGrammarIndex(lesson: GrammarLesson): GrammarIndex {
  return {
    id: lesson.id,
    title: lesson.title,
    pattern: lesson.pattern,
    level: lesson.level,
    order: lesson.order,
    status: lesson.status,
    hanzi: lesson.hanzi,
    words: lesson.words,
    haystack: grammarHaystack(lesson),
  };
}
