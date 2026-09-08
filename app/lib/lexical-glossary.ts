import type { CharRole, ContributionTransparency, MemberUiRole, RelationKind } from "./types";
import { MEMBER_UI_LABEL, RELATION_UI_LABEL } from "./lexical";

export interface GlossaryEntry {
  id: string;
  label: string;
  definition: string;
}

export const GLOSSARY = {
  semantic: {
    id: "semantic",
    label: "semantic",
    definition: "This character supplies meaning in the word.",
  },
  grammatical: {
    id: "grammatical",
    label: "grammatical",
    definition:
      "This character is doing grammar work (suffix, resultative, light verb) rather than naming a thing.",
  },
  phonetic: {
    id: "phonetic",
    label: "phonetic",
    definition: "This character is here for sound in this word, not for its usual meaning.",
  },
  transliteration: {
    id: "transliteration",
    label: "transliteration",
    definition: "This character writes a borrowed sound (a loanword syllable).",
  },
  transparent: {
    id: "transparent",
    label: "transparent",
    definition: "The character’s usual sense is still visible in the word.",
  },
  shifted: {
    id: "shifted",
    label: "shifted",
    definition: "The character contributes meaning, but not the first sense a learner meets.",
  },
  fossilized: {
    id: "fossilized",
    label: "fossilized",
    definition:
      "The character once contributed this sense; the modern word no longer uses it transparently.",
  },
  unknown: {
    id: "unknown",
    label: "unknown",
    definition: "The contribution is not securely attested.",
  },
  opaque: {
    id: "opaque",
    label: "opaque",
    definition:
      "The whole word cannot be derived from its characters — memorise it. (Word-level, not a character role.)",
  },
  "register-set": {
    id: "register-set",
    label: RELATION_UI_LABEL["register-set"],
    definition:
      "Same meaning, different situation: textbook vs conversation, chat, formal, or regional.",
  },
  "synonym-set": {
    id: "synonym-set",
    label: RELATION_UI_LABEL["synonym-set"],
    definition: "Near-synonyms of this sense. They are not automatically interchangeable.",
  },
  "antonym-pair": {
    id: "antonym-pair",
    label: RELATION_UI_LABEL["antonym-pair"],
    definition: "Two forms that oppose each other on one named meaning axis.",
  },
  textbook: {
    id: "textbook",
    label: MEMBER_UI_LABEL.textbook,
    definition: "The form HSK and classroom materials usually teach.",
  },
  everyday: {
    id: "everyday",
    label: MEMBER_UI_LABEL.everyday,
    definition: "Common in daily life, including speech.",
  },
  conversation: {
    id: "conversation",
    label: MEMBER_UI_LABEL.conversation,
    definition: "Typical in spoken conversation.",
  },
  chat: {
    id: "chat",
    label: MEMBER_UI_LABEL.chat,
    definition: "Typical in messaging and informal writing.",
  },
  formal: {
    id: "formal",
    label: MEMBER_UI_LABEL.formal,
    definition: "Typical in writing, official, or technical settings.",
  },
  regional: {
    id: "regional",
    label: MEMBER_UI_LABEL.regional,
    definition: "Associated with a region; may still be widely understood.",
  },
  "out-of-corpus": {
    id: "out-of-corpus",
    label: "not on HSK",
    definition:
      "A spoken, chat, slang, or regional form that is not an HSK word. There is no textbook page — meaning, register, region, and currency are listed here.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

export const GLOSSARY_KEYS = Object.keys(GLOSSARY) as GlossaryKey[];

export function isGlossaryKey(value: string): value is GlossaryKey {
  return value in GLOSSARY;
}

export function glossaryForRole(role: CharRole): GlossaryEntry {
  return GLOSSARY[role];
}

export function glossaryForTransparency(value: ContributionTransparency | "opaque"): GlossaryEntry {
  return GLOSSARY[value];
}

export function glossaryForRelation(kind: RelationKind): GlossaryEntry {
  return GLOSSARY[kind];
}

export function glossaryAriaLabel(key: GlossaryKey): string {
  const entry = GLOSSARY[key];
  return `${entry.label}: ${entry.definition}`;
}
