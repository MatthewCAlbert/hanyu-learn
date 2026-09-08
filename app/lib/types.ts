/**
 * HSK 3.0 levels. The standard defines nine, but its wordlist treats 7-9 as a
 * single band, so level 7 here means "7-9" and is labelled that way.
 */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Status = "stub" | "drafted" | "reviewed";
export type Confidence = "high" | "medium" | "low";
export type EtymologyType = "pictographic" | "ideographic" | "pictophonetic";

export type Formation =
  | "semantic-compound"
  | "verb-object"
  | "phonetic-loan"
  | "abbreviation"
  | "loanword-calque"
  | "idiom"
  | "reduplication";

export type Transparency = "transparent" | "semi" | "opaque";

export interface Sentence {
  id: string;
  cmn: string;
  eng: string;
}

export interface Radical {
  /** Canonical Kangxi radical and the route key, e.g. 人. */
  char: string;
  /** Kept equal to `char`; the canonical form is the group identity. */
  canonical: string;
  /** Genuine variant forms of this radical written inside these characters. */
  variants: string[];
  /** The form to show in headings: the dominant written variant, so a
   *  simplified-character learner sees 讠 rather than the canonical 言. */
  display: string;
  number: number;
  strokes: number;
  gloss: string;
  /** Hanzi under this radical, by level. */
  hanzi: string[];
}

export interface Etymology {
  type: EtymologyType;
  hint?: string;
  phonetic?: string;
  semantic?: string;
  /**
   * False when the recorded component is not actually present in the simplified
   * character — the clue was lost in simplification (e.g. 過 -> 过 dropped 咼).
   * Worth surfacing: it tells the learner not to look for a sound hint.
   */
  phoneticVisible?: boolean;
  semanticVisible?: boolean;
}

export interface Reading {
  pinyin: string;
  meanings: string[];
}

export interface Hanzi {
  char: string;
  level: Level;
  /** Primary reading first; 中 has zhōng and zhòng, 好 has hǎo and hào. */
  readings: Reading[];
  pinyin: string[];
  meanings: string[];
  /** Present when the character is also a standalone HSK vocabulary entry. */
  frequency: number | null;
  pos: string[];
  traditional: string | null;
  /** The form written inside this character, e.g. 亻 — for display. */
  radical: string;
  /** Canonical Kangxi radical — the grouping key. Two characters written with
   *  亻 and 人 belong to the same radical (#9 人). */
  radicalCanonical: string;
  radicalNumber: number;
  decomposition: string;
  components: string[];
  strokeCount: number | null;
  etymology: Etymology | null;
  /** Words at any level that contain this character. */
  words: string[];
  sentences: Sentence[];
  /** Levels from the other HSK standards this character's words appear in. */
  standards: string[];
  /** Themes this character belongs to. Zero, one, or many. */
  topics: string[];
  /** Relation ids this character is a member of. */
  relationIds: string[];
  /** Grammar lessons that list this character. Inverted from content/grammar/. */
  grammarLessonIds: string[];
  /** Overlaid from content/hanzi/<char>.md */
  authored: AuthoredHanzi | null;
}

export interface AuthoredHanzi {
  status: Status;
  semantic: string | null;
  phonetic: string | null;
  confidence: Confidence;
  sources: string[];
  etymology: string | null;
  mnemonic: string | null;
  notes: string | null;
}

export interface Word {
  word: string;
  level: Level;
  /** True for supplement vocabulary that is not on the HSK 3.0 wordlist. */
  extra: boolean;
  readings: Reading[];
  pinyin: string;
  meanings: string[];
  frequency: number | null;
  pos: string[];
  traditional: string | null;
  classifiers: string[];
  chars: string[];
  sentences: Sentence[];
  standards: string[];
  /** Themes this word belongs to. Zero, one, or many. */
  topics: string[];
  /** Relation ids this word is a member of. */
  relationIds: string[];
  /** Grammar lessons that list this word. Inverted from content/grammar/. */
  grammarLessonIds: string[];
  authored: AuthoredWord | null;
}

export type CharRole = "semantic" | "grammatical" | "phonetic" | "transliteration";
export type ContributionTransparency = "transparent" | "shifted" | "fossilized" | "unknown";
export type CharSalience = "primary" | "secondary" | "none";
export type EvidenceKind =
  | "orthographic"
  | "normative"
  | "corpus"
  | "lexicographic"
  | "model"
  | "reviewed";
export type UsageAssessment =
  | "everyday"
  | "situational"
  | "rare"
  | "dated"
  | "formal"
  | "spoken"
  | "regional"
  | "unknown";
export type LexicalRegister =
  | "textbook"
  | "spoken"
  | "written"
  | "formal"
  | "literary"
  | "colloquial";
export type LexicalContext = "speech" | "chat" | "writing" | "classroom" | "official";
export type LexicalRegion = "northern" | "southern" | "mainland" | "taiwan" | "widespread";
export type LexicalCurrency = "current" | "dated" | "declining";
export type RelationKind = "synonym-set" | "antonym-pair" | "register-set";
export type RelationMemberKind = "word" | "hanzi" | "lexeme";
export type MemberUiRole =
  | "textbook"
  | "everyday"
  | "conversation"
  | "chat"
  | "formal"
  | "regional";

export interface CharLink {
  char: string;
  role: CharRole;
  transparency: ContributionTransparency;
  contribution: string;
  salience?: CharSalience;
}

export interface UsageEvidence {
  kind: EvidenceKind;
  source: string;
  note?: string;
  accessed?: string;
  genre?: string;
}

export interface UsageProfile {
  assessment: UsageAssessment;
  register?: LexicalRegister;
  contexts: LexicalContext[];
  regions: LexicalRegion[];
  currency: LexicalCurrency;
  evidence: UsageEvidence[];
}

export interface RelationMember {
  form: string;
  kind: RelationMemberKind;
  role?: MemberUiRole;
  register?: LexicalRegister;
  contexts: LexicalContext[];
  regions: LexicalRegion[];
  currency?: LexicalCurrency;
  sense?: string;
  pos: string[];
}

export interface Relation {
  id: string;
  kind: RelationKind;
  label: string;
  axis: string | null;
  status: Status;
  confidence: Confidence;
  sources: string[];
  members: RelationMember[];
  distinctions: string | null;
  evidence: string | null;
}

export interface Lexeme {
  form: string;
  pinyin: string;
  meanings: string[];
  pos: string[];
  register: LexicalRegister;
  contexts: LexicalContext[];
  regions: LexicalRegion[];
  currency: LexicalCurrency;
  status: Status;
  confidence: Confidence;
  sources: string[];
  notes: string | null;
  relationIds: string[];
}

export interface RelationMemberCard extends RelationMember {
  pinyin: string;
  meaning: string;
  inCorpus: boolean;
  href: string | null;
}

export interface RelationCard {
  id: string;
  kind: RelationKind;
  uiLabel: string;
  label: string;
  axis: string | null;
  distinctions: string | null;
  members: RelationMemberCard[];
}

export interface AuthoredWord {
  status: Status;
  formation: Formation;
  literal: string;
  actual: string;
  transparency: Transparency;
  confidence: Confidence;
  sources: string[];
  why: string | null;
  notes: string | null;
  chars: CharLink[];
  usage: UsageProfile | null;
}

export interface Topic {
  id: string;
  label: string;
  description: string;
  hanzi: string[];
  words: string[];
}

export interface GrammarExample {
  cmn: string;
  eng: string;
}

/** Compact lesson chip used on hanzi/word detail pages and curriculum cards. */
export interface GrammarLessonRef {
  id: string;
  title: string;
  pattern: string;
  level: Level;
}

export interface GrammarLesson {
  id: string;
  title: string;
  pattern: string;
  level: Level;
  order: number;
  status: Status;
  confidence: Confidence;
  sources: string[];
  prerequisites: string[];
  hanzi: string[];
  words: string[];
  examples: GrammarExample[];
  patternNotes: string | null;
  usage: string | null;
  notes: string | null;
}

/** Compact per-level row for the grammar curriculum tab. */
export interface GrammarIndex {
  id: string;
  title: string;
  pattern: string;
  level: Level;
  order: number;
  status: Status;
  hanzi: string[];
  words: string[];
  /** Lowercased blob of title, pattern, prose, examples, and linked forms. */
  haystack: string;
}

/** Precomputed grammar lesson page. One of these lives in a hash bucket. */
export interface GrammarPage {
  lesson: GrammarLesson;
  hanzi: {
    char: string;
    pinyin: string;
    meaning: string;
    level: Level;
  }[];
  words: {
    word: string;
    pinyin: string;
    meaning: string;
    level: Level;
    extra: boolean;
  }[];
  prerequisites: GrammarLessonRef[];
}

export interface RelationCandidate {
  reason: string;
  forms: string[];
  kind: RelationKind | "char-link" | "usage";
  sources: string[];
  textbookPercentile: number | null;
}

export interface Dataset {
  hanzi: Hanzi[];
  words: Word[];
  radicals: Radical[];
  counts: Record<Level, { entries: number; hanzi: number; words: number; radicals: number }>;
}

/** Compact per-level row used for browsing, filtering and grouping. */
export interface HanziIndex {
  char: string;
  level: Level;
  pinyin: string[];
  meanings: string[];
  frequency: number | null;
  radical: string;
  radicalCanonical: string;
  components: string[];
  standards: string[];
  topics: string[];
  status: Status;
  /** Visible phonetic component, if any. Used on radical and phonetic pages. */
  phonetic: string | null;
  /** Visible meaning-bearing component, if any. */
  semantic: string | null;
}

/** Compact per-level row used for browsing, filtering and grouping. */
export interface WordIndex {
  word: string;
  level: Level;
  extra: boolean;
  pinyin: string;
  meanings: string[];
  frequency: number | null;
  standards: string[];
  topics: string[];
  status: Status;
  literal: string | null;
  transparency: Transparency | null;
}

export interface DatasetMeta {
  radicals: Radical[];
  topics: Topic[];
  relations: Relation[];
  lexemes: Lexeme[];
  counts: Dataset["counts"];
  extraWords: number;
}

export interface DatasetManifest {
  version: string;
  buckets: number;
}

export interface ComponentRole {
  form: string;
  gloss: string;
  href: string | null;
}

export interface PhoneticRole extends ComponentRole {
  href: string;
  anchor: string;
  pinyin: string[];
}

/** Compact metadata for one phonetic-series key. Members live in the hanzi indexes. */
export interface PhoneticAnchor {
  component: string;
  /** Form that carries a reading: 礻 → 示. */
  anchor: string;
  pinyin: string[];
  meaning: string | null;
  radical: Pick<Radical, "char" | "display" | "gloss" | "number" | "canonical"> | null;
  /** Corpus character to open for the component itself, if any. */
  hanzi: string | null;
}

/** Precomputed hanzi detail page. One of these lives in a hash bucket. */
export interface HanziPage {
  hanzi: Hanzi;
  radical: Pick<Radical, "char" | "display" | "gloss" | "number" | "canonical"> | null;
  etymology: Hanzi["etymology"];
  glosses: Record<string, string>;
  /** href per decomposition leaf; null means render without a link. */
  componentHrefs: Record<string, string | null>;
  semanticRole: ComponentRole | null;
  phoneticRole: PhoneticRole | null;
  phoneticSeries: { char: string; pinyin: string; meaning: string }[];
  words: {
    word: string;
    pinyin: string;
    meaning: string;
    level: Level;
    extra: boolean;
    salience: CharSalience | null;
  }[];
  topics: { id: string; label: string }[];
  relations: RelationCard[];
  grammar: GrammarLessonRef[];
}

/** Precomputed word detail page. One of these lives in a hash bucket. */
export interface WordPage {
  word: Word;
  chars: {
    char: string;
    pinyin: string;
    meaning: string;
    level: Level | null;
    radical: string | null;
    link: CharLink | null;
  }[];
  topics: { id: string; label: string }[];
  relations: RelationCard[];
  grammar: GrammarLessonRef[];
  usage: UsageProfile | null;
}
