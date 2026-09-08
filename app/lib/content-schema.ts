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

export const charRoleSchema = z.enum([
  "semantic",
  "grammatical",
  "phonetic",
  "transliteration",
]);

export const contributionTransparencySchema = z.enum([
  "transparent",
  "shifted",
  "fossilized",
  "unknown",
]);

export const charSalienceSchema = z.enum(["primary", "secondary", "none"]);

export const evidenceKindSchema = z.enum([
  "orthographic",
  "normative",
  "corpus",
  "lexicographic",
  "model",
  "reviewed",
]);

export const usageAssessmentSchema = z.enum([
  "everyday",
  "situational",
  "rare",
  "dated",
  "formal",
  "spoken",
  "regional",
  "unknown",
]);

export const lexicalRegisterSchema = z.enum([
  "textbook",
  "spoken",
  "written",
  "formal",
  "literary",
  "colloquial",
]);

export const lexicalContextSchema = z.enum([
  "speech",
  "chat",
  "writing",
  "classroom",
  "official",
]);

export const lexicalRegionSchema = z.enum([
  "northern",
  "southern",
  "mainland",
  "taiwan",
  "widespread",
]);

export const lexicalCurrencySchema = z.enum(["current", "dated", "declining"]);

export const relationKindSchema = z.enum([
  "synonym-set",
  "antonym-pair",
  "register-set",
]);

export const relationMemberKindSchema = z.enum(["word", "hanzi", "lexeme"]);

export const memberUiRoleSchema = z.enum([
  "textbook",
  "everyday",
  "conversation",
  "chat",
  "formal",
  "regional",
]);

export const kebabIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "must be lower-case kebab-case");

export const charLinkSchema = z.object({
  char: z.string().length(1),
  role: charRoleSchema,
  transparency: contributionTransparencySchema,
  contribution: z.string().min(1),
  salience: charSalienceSchema.optional(),
});

export const usageEvidenceSchema = z.object({
  kind: evidenceKindSchema,
  source: z.string().min(1),
  note: z.string().min(1).optional(),
  accessed: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
});

export const usageProfileSchema = z.object({
  assessment: usageAssessmentSchema,
  register: lexicalRegisterSchema.optional(),
  contexts: z.array(lexicalContextSchema).default([]),
  regions: z.array(lexicalRegionSchema).default([]),
  currency: lexicalCurrencySchema.default("current"),
  evidence: z.array(usageEvidenceSchema).default([]),
});

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
  chars: z.array(charLinkSchema).default([]),
  usage: usageProfileSchema.nullish(),
});

/**
 * Topic files own their membership, so tagging 200 words is one reviewable diff
 * rather than 200 files. The set of files is the controlled vocabulary.
 */
export const topicFrontmatter = z.object({
  topic: kebabIdSchema,
  label: z.string().min(1),
  hanzi: z.array(z.string().length(1)).default([]),
  words: z.array(z.string().min(1)).default([]),
});

export const relationMemberSchema = z.object({
  form: z.string().min(1),
  kind: relationMemberKindSchema,
  role: memberUiRoleSchema.optional(),
  register: lexicalRegisterSchema.optional(),
  contexts: z.array(lexicalContextSchema).default([]),
  regions: z.array(lexicalRegionSchema).default([]),
  currency: lexicalCurrencySchema.optional(),
  sense: z.string().min(1).optional(),
  pos: z.array(z.string().min(1)).default([]),
});

export const relationFrontmatter = z
  .object({
    relation: kebabIdSchema,
    kind: relationKindSchema,
    label: z.string().min(1),
    axis: z.string().min(1).nullish(),
    status: statusSchema.default("drafted"),
    confidence: confidenceSchema,
    sources: z.array(z.string().min(1)).default([]),
    members: z.array(relationMemberSchema).min(2),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "antonym-pair") {
      if (val.members.length !== 2) {
        ctx.addIssue({
          code: "custom",
          message: "antonym-pair must have exactly 2 members",
          path: ["members"],
        });
      }
      if (!val.axis) {
        ctx.addIssue({
          code: "custom",
          message: "antonym-pair requires axis",
          path: ["axis"],
        });
      }
    } else if (val.members.length > 6) {
      ctx.addIssue({
        code: "custom",
        message: `${val.kind} must have 2–6 members`,
        path: ["members"],
      });
    }
  });

export const lexemeFrontmatter = z.object({
  form: z.string().min(1),
  pinyin: z.string().min(1),
  meanings: z.array(z.string().min(1)).min(1),
  pos: z.array(z.string().min(1)).default([]),
  register: lexicalRegisterSchema,
  contexts: z.array(lexicalContextSchema).default([]),
  regions: z.array(lexicalRegionSchema).default([]),
  currency: lexicalCurrencySchema.default("current"),
  status: statusSchema.default("drafted"),
  confidence: confidenceSchema,
  sources: z.array(z.string().min(1)).default([]),
});

/** HSK 3.0 bands; 7 is the merged 7–9 wordlist band. */
export const levelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

export const grammarExampleSchema = z.object({
  cmn: z.string().min(1),
  eng: z.string().min(1),
});

/**
 * Grammar lesson files own their hanzi/word links. The build inverts those
 * onto entries so a lesson is authored once and both directions stay in sync.
 */
export const grammarFrontmatter = z.object({
  lesson: kebabIdSchema,
  title: z.string().min(1),
  pattern: z.string().min(1),
  level: levelSchema,
  order: z.number().int().positive(),
  status: statusSchema.default("drafted"),
  confidence: confidenceSchema,
  sources: z.array(z.string().min(1)).default([]),
  prerequisites: z.array(kebabIdSchema).default([]),
  hanzi: z.array(z.string().length(1)).default([]),
  words: z.array(z.string().min(2)).default([]),
  examples: z.array(grammarExampleSchema).default([]),
});

export type TopicFrontmatter = z.infer<typeof topicFrontmatter>;
export type HanziFrontmatter = z.infer<typeof hanziFrontmatter>;
export type WordFrontmatter = z.infer<typeof wordFrontmatter>;
export type RelationFrontmatter = z.infer<typeof relationFrontmatter>;
export type LexemeFrontmatter = z.infer<typeof lexemeFrontmatter>;
export type GrammarFrontmatter = z.infer<typeof grammarFrontmatter>;
export type CharLinkFrontmatter = z.infer<typeof charLinkSchema>;
export type UsageProfileFrontmatter = z.infer<typeof usageProfileSchema>;

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
