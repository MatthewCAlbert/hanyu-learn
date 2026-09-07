import type { PageContext, PageContextHintPane } from "./types";
import { mentionToken } from "./types";

export interface PromptSuggestion {
  id: string;
  label: string;
  prompt: string;
}

const MAX_CHIPS = 3;

function refText(pane: PageContextHintPane): string {
  return pane.mention ? mentionToken(pane.mention) : pane.label;
}

function uniqueReadings(readings: string[] | undefined): string[] {
  if (!readings) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of readings) {
    const t = r.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Page-aware chips for an empty chat. Fill the composer; do not send. */
export function suggestionsFor(ctx: PageContext | null | undefined): PromptSuggestion[] {
  if (!ctx || ctx.kind === "none") return [];
  const hints = ctx.hints;
  const chips: PromptSuggestion[] = [];

  if (ctx.kind === "compare") {
    const left = hints?.left;
    const right = hints?.right;
    if (left && right) {
      chips.push({
        id: "usage",
        label: `Usage: ${left.label} vs ${right.label}`,
        prompt: `What’s the difference in usage between ${refText(left)} and ${refText(right)}? When would I pick one over the other?`,
      });
    }
  }

  if (hints?.missingAuthored && ctx.kind === "hanzi") {
    const token = hints.left ? refText(hints.left) : ctx.title;
    const name = hints.left?.label ?? ctx.title;
    chips.push({
      id: "etymology",
      label: "Explain the etymology",
      prompt: `This page doesn’t have an authored etymology for ${token} yet. Explain the attested origin of ${name}, keep etymology separate from any mnemonic, and say so if it isn’t securely attested.`,
    });
  }

  if (hints?.missingAuthored && ctx.kind === "word") {
    const token = hints.left ? refText(hints.left) : ctx.title;
    const name = hints.left?.label ?? ctx.title;
    chips.push({
      id: "formation",
      label: "How is this word built?",
      prompt: `This page doesn’t have formation notes for ${token} yet. Explain how ${name} is built from its characters, literal vs actual meaning, and which reading of each character it uses.`,
    });
  }

  const readings = uniqueReadings(hints?.readings);
  if (ctx.kind === "hanzi" && readings.length >= 2) {
    chips.push({
      id: "readings",
      label: `When do I use ${readings.join(" vs ")}?`,
      prompt: `When do I use ${readings.join(" vs ")} for ${hints?.left ? refText(hints.left) : ctx.title}?`,
    });
  }

  if (ctx.kind === "hanzi" || ctx.kind === "word" || ctx.kind === "compare") {
    chips.push({
      id: "examples",
      label: "Give 3 example sentences",
      prompt: "Give 3 example sentences at this HSK level.",
    });
  }

  return chips.slice(0, MAX_CHIPS);
}
