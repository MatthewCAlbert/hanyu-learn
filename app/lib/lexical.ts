import type {
  CharSalience,
  Hanzi,
  Lexeme,
  MemberUiRole,
  Relation,
  RelationCard,
  RelationKind,
  RelationMemberCard,
  Word,
} from "./types";

export const RELATION_UI_LABEL: Record<RelationKind, string> = {
  "register-set": "Real-life alternatives",
  "synonym-set": "Similar words",
  "antonym-pair": "Opposites",
};

export const MEMBER_UI_LABEL: Record<MemberUiRole, string> = {
  textbook: "Textbook/neutral",
  everyday: "Everyday",
  conversation: "Conversation",
  chat: "Chat",
  formal: "Formal",
  regional: "Regional",
};

export const CHAR_CONTRIBUTION_SECTION = "How this character works in words";
export const SPOKEN_SECTION = "Spoken and chat";

export function lexemeHref(form: string): string {
  return `/lexemes/${encodeURIComponent(form)}`;
}

/** One-character spoken/chat forms that are not HSK hanzi. */
export function isHanziLexeme(form: string): boolean {
  return [...form].length === 1;
}

const SALIENCE_ORDER: Record<CharSalience, number> = {
  primary: 0,
  secondary: 1,
  none: 2,
};

export function rankContainedWords<
  T extends {
    extra: boolean;
    level: number;
    frequency: number | null;
    word: string;
    salience?: CharSalience | null;
  },
>(words: T[]): T[] {
  return [...words].sort((a, b) => {
    if (a.extra !== b.extra) return a.extra ? 1 : -1;
    const sa = SALIENCE_ORDER[a.salience ?? "none"];
    const sb = SALIENCE_ORDER[b.salience ?? "none"];
    if (sa !== sb) return sa - sb;
    if (a.level !== b.level) return a.level - b.level;
    const fa = a.frequency ?? -1;
    const fb = b.frequency ?? -1;
    if (fa !== fb) return fb - fa;
    return a.word.localeCompare(b.word, "zh");
  });
}

/** Within-level percentile (100 = most frequent in that HSK band). Extra words are null. */
export function textbookPercentiles(
  words: { word: string; extra: boolean; level: number; frequency: number | null }[],
): Map<string, number> {
  const out = new Map<string, number>();
  const byLevel = new Map<number, { word: string; frequency: number }[]>();
  for (const w of words) {
    if (w.extra || w.frequency == null) continue;
    const cur = byLevel.get(w.level);
    if (cur) cur.push({ word: w.word, frequency: w.frequency });
    else byLevel.set(w.level, [{ word: w.word, frequency: w.frequency }]);
  }
  for (const group of byLevel.values()) {
    const sorted = [...group].sort(
      (a, b) => b.frequency - a.frequency || a.word.localeCompare(b.word, "zh"),
    );
    const n = sorted.length;
    sorted.forEach((row, i) => {
      const percentile = n === 1 ? 100 : Math.round((1 - i / (n - 1)) * 100);
      out.set(row.word, percentile);
    });
  }
  return out;
}

export function toRelationCard(
  relation: Relation,
  wordByText: Map<string, Pick<Word, "word" | "pinyin" | "meanings">>,
  hanziByChar: Map<string, Pick<Hanzi, "char" | "pinyin" | "meanings">>,
  lexemeByForm: Map<string, Lexeme>,
): RelationCard {
  const members = relation.members.map((m): RelationMemberCard => {
    if (m.kind === "word") {
      const w = wordByText.get(m.form);
      return {
        ...m,
        pinyin: w?.pinyin ?? "",
        meaning: w?.meanings[0] ?? m.sense ?? "",
        inCorpus: Boolean(w),
        href: w ? `/words/${encodeURIComponent(w.word)}` : null,
      };
    }
    if (m.kind === "hanzi") {
      const h = hanziByChar.get(m.form);
      return {
        ...m,
        pinyin: h?.pinyin[0] ?? "",
        meaning: h?.meanings[0] ?? m.sense ?? "",
        inCorpus: Boolean(h),
        href: h ? `/hanzi/${encodeURIComponent(h.char)}` : null,
      };
    }
    const lex = lexemeByForm.get(m.form);
    return {
      ...m,
      pinyin: lex?.pinyin ?? "",
      meaning: lex?.meanings[0] ?? m.sense ?? "",
      inCorpus: false,
      href: lexemeHref(m.form),
    };
  });
  return {
    id: relation.id,
    kind: relation.kind,
    uiLabel: RELATION_UI_LABEL[relation.kind],
    label: relation.label,
    axis: relation.axis,
    distinctions: relation.distinctions,
    members,
  };
}

export function relationsForForm(relations: Relation[], form: string): Relation[] {
  return relations.filter((r) => r.members.some((m) => m.form === form));
}
