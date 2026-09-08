import type { EntryRef } from "~/lib/compare";
import type {
  CompareEntry,
  ComparePane,
  HanziDetailData,
  WordDetailData,
} from "~/lib/detail-data";
import type { BoundSong } from "~/lib/song";
import type { TextAnalysis } from "~/lib/segment";
import type { MentionRef, PageContext, PageContextHintPane } from "./types";
import { entryMentionKind } from "./types";
import type { RelationCard, Status, UsageProfile } from "~/lib/types";

const SENTENCE_CAP = 5;
const WORD_CAP = 24;
const MEMBER_CAP = 20;

function clip(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function sentences(
  list: { cmn: string; eng: string }[] | undefined,
): string {
  if (!list?.length) return "";
  return list
    .slice(0, SENTENCE_CAP)
    .map((s) => `- ${s.cmn} / ${s.eng}`)
    .join("\n");
}

export function serializeHanziContext(data: HanziDetailData, route?: string): PageContext {
  const h = data.hanzi;
  const a = h.authored;
  const e = data.etymology ?? h.etymology;
  const lines: string[] = [
    `Hanzi: ${h.char}`,
    `Pinyin: ${h.pinyin.join(", ")}`,
    `Meanings: ${h.meanings.join("; ")}`,
    `Level: HSK ${h.level}`,
  ];
  if (h.traditional) lines.push(`Traditional: ${h.traditional}`);
  if (h.pos.length) lines.push(`POS: ${h.pos.join(", ")}`);
  if (data.radical) {
    lines.push(
      `Dictionary radical: ${data.radical.display} (${data.radical.gloss}, Kangxi #${data.radical.number}, canonical ${data.radical.canonical})`,
    );
  }
  if (e) {
    lines.push(`Etymology type: ${e.type}`);
    if (e.hint) lines.push(`Etymology hint: ${e.hint}`);
    if (data.semanticRole) {
      lines.push(`Semantic component (meaning): ${data.semanticRole.form} ${data.semanticRole.gloss}`);
    }
    if (data.phoneticRole) {
      lines.push(
        `Phonetic component (sound only): ${data.phoneticRole.form} ${data.phoneticRole.pinyin.join(" ")} ${data.phoneticRole.gloss}`,
      );
    }
    if (e.phonetic && e.phoneticVisible === false) {
      lines.push(
        `The phonetic ${e.phonetic} was lost in simplification — the modern form has no sound clue.`,
      );
    }
  }
  if (h.decomposition) lines.push(`Decomposition: ${h.decomposition}`);
  if (h.components.length) lines.push(`Components: ${h.components.join(" ")}`);
  if (data.topics.length) {
    lines.push(`Topics: ${data.topics.map((t) => t.label).join(", ")}`);
  }
  if (data.relations?.length) {
    lines.push(serializeRelations(data.relations, 4));
  }
  if (a) {
    lines.push(`Authored status: ${a.status}, confidence: ${a.confidence}`);
    if (a.etymology) lines.push(`Etymology (attested):\n${clip(a.etymology)}`);
    if (a.mnemonic) lines.push(`Mnemonic (invented, not etymology):\n${clip(a.mnemonic)}`);
    if (a.notes) lines.push(`Notes:\n${clip(a.notes)}`);
    if (a.sources.length) lines.push(`Sources:\n${a.sources.map((s) => `- ${s}`).join("\n")}`);
  } else {
    lines.push("Authored etymology: not yet written.");
  }
  if (data.phoneticSeries.length) {
    lines.push(
      `Phonetic series (same sound component, unrelated meanings): ${data.phoneticSeries
        .slice(0, MEMBER_CAP)
        .map((p) => `${p.char} ${p.pinyin}`)
        .join(", ")}`,
    );
  }
  if (data.words.length) {
    lines.push(
      `Words using this character:\n${data.words
        .slice(0, WORD_CAP)
        .map((w) => `- ${w.word} ${w.pinyin} ${w.meaning}`)
        .join("\n")}`,
    );
  }
  const sx = sentences(h.sentences);
  if (sx) lines.push(`Example sentences (i+1, capped):\n${sx}`);

  const path = route ?? `/hanzi/${h.char}`;
  const mention: MentionRef = { kind: "hanzi", id: h.char };
  return {
    key: `hanzi:${h.char}`,
    route: path,
    title: `${h.char} ${h.pinyin[0] ?? ""}`.trim(),
    kind: "hanzi",
    text: lines.join("\n"),
    hints: {
      left: { label: h.char, mention },
      contentStatus: authoredStatus(a?.status),
      readings: h.pinyin,
      missingAuthored: !a || a.status === "stub" || !clip(a.etymology),
      hasRelations: (data.relations?.length ?? 0) > 0,
    },
  };
}

export function serializeWordContext(data: WordDetailData, route?: string): PageContext {
  const w = data.word;
  const a = w.authored;
  const lines: string[] = [
    `Word: ${w.word}`,
    `Pinyin: ${w.pinyin}`,
    `Meanings: ${w.meanings.join("; ")}`,
    w.extra ? "Band: Extra (not on HSK 3.0 wordlist)" : `Level: HSK ${w.level}`,
  ];
  if (w.traditional) lines.push(`Traditional: ${w.traditional}`);
  if (w.pos.length) lines.push(`POS: ${w.pos.join(", ")}`);
  if (w.classifiers.length) lines.push(`Classifiers: ${w.classifiers.join(" ")}`);
  if (data.topics.length) lines.push(`Topics: ${data.topics.map((t) => t.label).join(", ")}`);
  if (data.usage) lines.push(serializeUsage(data.usage));
  if (data.relations?.length) lines.push(serializeRelations(data.relations, 4));
  if (data.chars.length) {
    lines.push(
      `Characters:\n${data.chars
        .map((c) => {
          const link = c.link
            ? ` [${c.link.role}/${c.link.transparency}: ${c.link.contribution}]`
            : "";
          return `- ${c.char} ${c.pinyin} ${c.meaning}${c.level ? ` HSK ${c.level}` : ""}${link}`;
        })
        .join("\n")}`,
    );
  }
  if (a) {
    lines.push(`Formation: ${a.formation}`);
    lines.push(`Transparency: ${a.transparency}`);
    lines.push(`Literal: ${a.literal}`);
    lines.push(`Actual: ${a.actual}`);
    lines.push(`Authored status: ${a.status}, confidence: ${a.confidence}`);
    if (a.why) lines.push(`Why this combination:\n${clip(a.why)}`);
    if (a.notes) lines.push(`Notes:\n${clip(a.notes)}`);
    if (a.sources.length) lines.push(`Sources:\n${a.sources.map((s) => `- ${s}`).join("\n")}`);
  } else {
    lines.push("Authored word formation: not yet written.");
  }
  const sx = sentences(w.sentences);
  if (sx) lines.push(`Example sentences (i+1, capped):\n${sx}`);

  const path = route ?? `/words/${w.word}`;
  const mention: MentionRef = { kind: "word", id: w.word };
  return {
    key: `word:${w.word}`,
    route: path,
    title: `${w.word} ${w.pinyin}`.trim(),
    kind: "word",
    text: lines.join("\n"),
    hints: {
      left: { label: w.word, mention },
      contentStatus: authoredStatus(a?.status),
      readings: w.pinyin ? [w.pinyin] : [],
      missingAuthored: !a || a.status === "stub" || !clip(a.why),
      hasRelations: (data.relations?.length ?? 0) > 0,
      hasUsage: Boolean(data.usage),
    },
  };
}

export function serializeCompareEntry(entry: CompareEntry): string {
  switch (entry.kind) {
    case "hanzi":
      return serializeHanziContext(entry.data).text;
    case "word":
      return serializeWordContext(entry.data).text;
    case "radical": {
      const r = entry.data.radical;
      const members = entry.data.byLevel
        .flatMap((g) => g.members)
        .slice(0, MEMBER_CAP)
        .map((m) => `${m.char} ${m.pinyin}`)
        .join(", ");
      return [
        `Radical: ${r.display} (canonical ${r.canonical}, Kangxi #${r.number})`,
        `Gloss: ${r.gloss}`,
        `Members: ${entry.data.total}. Sample: ${members}`,
      ].join("\n");
    }
    case "phonetic": {
      const p = entry.data.meta;
      const members = entry.data.byLevel
        .flatMap((g) => g.members)
        .slice(0, MEMBER_CAP)
        .map((m) => `${m.char} ${m.pinyin[0] ?? ""}`)
        .join(", ");
      return [
        `Phonetic series: ${p.component} (anchor ${p.anchor})`,
        `Readings: ${p.pinyin.join(", ")}`,
        p.meaning ? `Anchor meaning: ${p.meaning}` : "",
        `Members: ${entry.data.total}. Sample: ${members}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "topic": {
      const t = entry.data.topic;
      const members = [...entry.data.byLevel.flatMap((g) => g.members), ...entry.data.extra]
        .slice(0, MEMBER_CAP)
        .map((m) => `${m.text} ${m.pinyin}`)
        .join(", ");
      return [
        `Topic: ${t.label} (${t.id})`,
        t.description,
        `Members: ${entry.data.total}. Sample: ${members}`,
      ].join("\n");
    }
  }
}

function serializeUsage(usage: UsageProfile): string {
  const bits = [
    `Usage assessment: ${usage.assessment}`,
    usage.register ? `register ${usage.register}` : "",
    usage.contexts.length ? `context ${usage.contexts.join("/")}` : "",
    usage.regions.length ? `region ${usage.regions.join("/")}` : "",
    `currency ${usage.currency}`,
  ].filter(Boolean);
  return bits.join(" · ");
}

function serializeRelations(relations: RelationCard[], cap: number): string {
  return `Relations:\n${relations
    .slice(0, cap)
    .map((r) => {
      const members = r.members
        .map((m) => `${m.form}${m.role ? ` (${m.role})` : ""}${m.inCorpus ? "" : " [not on HSK]"}`)
        .join(", ");
      return `- ${r.uiLabel} (${r.label}): ${members}`;
    })
    .join("\n")}`;
}

function paneBlock(label: string, pane: ComparePane): string {
  if (pane.status === "empty") return `${label}: empty`;
  if (pane.status === "invalid") return `${label}: invalid selection (${pane.raw})`;
  if (pane.status === "missing") return `${label}: ${pane.ref.kind}:${pane.ref.id} is not in the corpus`;
  return `${label} (${pane.entry.kind}:${pane.entry.ref.id}):\n${serializeCompareEntry(pane.entry)}`;
}

export function serializeTranslateContext(text: string, analysis: TextAnalysis, route: string): PageContext {
  const preview = text.trim().replace(/\s+/g, " ");
  const title = preview ? (preview.length > 24 ? `${preview.slice(0, 23)}…` : preview) : "Translate";
  const lines: string[] = ["Translate workspace", `Source:\n${text.slice(0, 1200)}`];
  const linked = analysis.blocks.flatMap((b) =>
    b.spans.filter((s) => s.ref).slice(0, 40),
  );
  if (linked.length) {
    lines.push(
      "",
      "Corpus spans:",
      ...linked.slice(0, 24).map((s) => {
        const gloss = s.summary ? ` ${s.summary.pinyin} / ${s.summary.meaning}` : "";
        return `- ${s.id} ${s.ref?.kind}:${s.text}${gloss}`;
      }),
    );
  }
  return {
    key: `translate:${text.slice(0, 80)}:${analysis.blocks.length}`,
    route,
    title,
    kind: "translate",
    text: lines.join("\n"),
    hints: { contentStatus: "none" },
  };
}

export function serializeSongContext(song: BoundSong, route: string): PageContext {
  const title = song.title && song.artist ? `${song.title} — ${song.artist}` : song.title || "Song";
  const lines: string[] = [
    "Song workspace",
    `Title: ${song.title}`,
    `Artist: ${song.artist}`,
  ];
  if (song.album) lines.push(`Album: ${song.album}`);
  if (song.year) lines.push(`Year: ${song.year}`);
  lines.push(`Lyrics source: ${song.lyricsSourceUrl}`);
  if (!song.complete) lines.push("Completeness: incomplete — verify with the cited source.");
  if (song.warning) lines.push(`Warning: ${song.warning}`);
  if (song.unavailable) {
    lines.push("Lyrics were not available from the cited source.");
  } else {
    lines.push("", `Lyrics:\n${song.sourceText.slice(0, 1200)}`);
    const linked = song.analysis.blocks.flatMap((b) => b.spans.filter((s) => s.ref).slice(0, 40));
    if (linked.length) {
      lines.push(
        "",
        "Corpus spans:",
        ...linked.slice(0, 24).map((s) => {
          const gloss = s.summary ? ` ${s.summary.pinyin} / ${s.summary.meaning}` : "";
          return `- ${s.id} ${s.ref?.kind}:${s.text}${gloss}`;
        }),
      );
    }
  }
  return {
    key: `song:${song.title}:${song.artist}:${song.sourceText.slice(0, 80)}`,
    route,
    title,
    kind: "song",
    text: lines.join("\n"),
    hints: { contentStatus: "none" },
  };
}

export function serializeCompareContext(
  left: ComparePane,
  right: ComparePane,
  route: string,
): PageContext {
  const leftRef = paneRef(left);
  const rightRef = paneRef(right);
  const title = [paneTitle(left), paneTitle(right)].filter(Boolean).join(" vs ") || "Compare";
  return {
    key: `compare:${leftRef ?? "∅"}|${rightRef ?? "∅"}`,
    route,
    title,
    kind: "compare",
    text: ["Compare workspace", paneBlock("Left", left), "", paneBlock("Right", right)].join("\n"),
    hints: {
      left: paneHint(left),
      right: paneHint(right),
      contentStatus: "none",
    },
  };
}

function paneRef(pane: ComparePane): string | null {
  if (pane.status === "ready") return `${pane.entry.kind}:${pane.entry.ref.id}`;
  if (pane.status === "missing") return `${pane.ref.kind}:${pane.ref.id}`;
  if (pane.status === "invalid") return `invalid:${pane.raw}`;
  return null;
}

function authoredStatus(status: Status | undefined): "stub" | "drafted" | "reviewed" {
  return status ?? "stub";
}

function paneHint(pane: ComparePane): PageContextHintPane | undefined {
  const label = paneTitle(pane);
  if (!label) return undefined;
  if (pane.status === "ready") {
    const kind = entryMentionKind(pane.entry.kind);
    if (kind) return { label, mention: { kind, id: pane.entry.ref.id } };
  }
  return { label };
}

function paneTitle(pane: ComparePane): string {
  if (pane.status === "ready") {
    switch (pane.entry.kind) {
      case "hanzi":
        return pane.entry.data.hanzi.char;
      case "word":
        return pane.entry.data.word.word;
      case "radical":
        return pane.entry.data.radical.display;
      case "phonetic":
        return pane.entry.data.meta.component;
      case "topic":
        return pane.entry.data.topic.label;
    }
  }
  return "";
}

export function emptyPageContext(): PageContext {
  return {
    key: "none",
    route: "/",
    title: "Browse",
    kind: "none",
    text: "No hanzi, word, or compare page is open. Use corpus tools if you need an entry.",
  };
}

export function formatUserTurn(text: string, snapshot: PageContext | null): string {
  if (!snapshot || snapshot.kind === "none") return text;
  return `<page-context key="${snapshot.key}" route="${snapshot.route}">\n${snapshot.text}\n</page-context>\n\n${text}`;
}

export function contextChanged(prevKey: string | undefined, next: PageContext | null): boolean {
  if (!next || next.kind === "none") return false;
  return prevKey !== next.key;
}

export function lookupKey(ref: EntryRef): string {
  return `${ref.kind}:${ref.id}`;
}
