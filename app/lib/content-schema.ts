import { z } from "zod";

export const statusSchema = z.enum(["stub", "drafted", "reviewed"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const formationSchema = z.enum([
  "semantic-compound",
  "verb-object",
  "phonetic-loan",
  "abbreviation",
  "loanword-calque",
  "idiom",
  "reduplication",
]);

export const transparencySchema = z.enum(["transparent", "semi", "opaque"]);

export const hanziFrontmatter = z.object({
  char: z.string().length(1),
  status: statusSchema,
  semantic: z.string().min(1).nullish(),
  phonetic: z.string().min(1).nullish(),
  confidence: confidenceSchema,
  sources: z.array(z.string().min(1)).default([]),
});

export const wordFrontmatter = z.object({
  word: z.string().min(2),
  status: statusSchema.default("drafted"),
  formation: formationSchema,
  literal: z.string().min(1),
  actual: z.string().min(1),
  transparency: transparencySchema,
  confidence: confidenceSchema,
  sources: z.array(z.string().min(1)).default([]),
});

/**
 * Topic files own their membership, so tagging 200 words is one reviewable diff
 * rather than 200 files. The set of files is the controlled vocabulary.
 */
export const topicFrontmatter = z.object({
  topic: z.string().regex(/^[a-z][a-z0-9-]*$/, "must be lower-case kebab-case"),
  label: z.string().min(1),
  hanzi: z.array(z.string().length(1)).default([]),
  words: z.array(z.string().min(1)).default([]),
});

export type TopicFrontmatter = z.infer<typeof topicFrontmatter>;
export type HanziFrontmatter = z.infer<typeof hanziFrontmatter>;
export type WordFrontmatter = z.infer<typeof wordFrontmatter>;

/** Split an authored markdown body into its `## Heading` sections. */
export function sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (key) out[key] = buf.join("\n").trim();
    buf = [];
  };
  for (const line of body.split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      key = h[1]!.toLowerCase();
    } else if (key) {
      buf.push(line);
    }
  }
  flush();
  return out;
}
