/**
 * Relation membership is authored in relation-centric files and inverted onto
 * entries at build time, the same way topics are.
 */
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import relationsJson from "~/data/generated/relations.json";
import lexemesJson from "~/data/generated/lexemes.json";
import type { Hanzi, Lexeme, Relation, Word } from "~/lib/types";
import { RELATION_UI_LABEL } from "~/lib/lexical";
import { relationFrontmatter } from "~/lib/content-schema";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const R = relationsJson as unknown as Relation[];
const L = lexemesJson as unknown as Lexeme[];

describe("relation vocabulary", () => {
  it("has unique kebab-case ids and learner-facing kinds", () => {
    const ids = new Set<string>();
    for (const r of R) {
      expect(r.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ids.has(r.id), `duplicate ${r.id}`).toBe(false);
      ids.add(r.id);
      expect(RELATION_UI_LABEL[r.kind].length).toBeGreaterThan(0);
      expect(r.members.length).toBeGreaterThanOrEqual(2);
      if (r.kind === "antonym-pair") {
        expect(r.members).toHaveLength(2);
        expect(r.axis).toBeTruthy();
      }
    }
  });

  it("only references corpus words, hanzi, or lexemes", () => {
    const chars = new Set(H.map((h) => h.char));
    const wordSet = new Set(W.map((w) => w.word));
    const lexSet = new Set(L.map((l) => l.form));
    for (const r of R) {
      for (const m of r.members) {
        if (m.kind === "word") expect(wordSet.has(m.form), `${r.id}: ${m.form}`).toBe(true);
        if (m.kind === "hanzi") expect(chars.has(m.form), `${r.id}: ${m.form}`).toBe(true);
        if (m.kind === "lexeme") expect(lexSet.has(m.form), `${r.id}: ${m.form}`).toBe(true);
      }
    }
  });

  it("does not duplicate a corpus word as a lexeme", () => {
    const wordSet = new Set(W.map((w) => w.word));
    for (const l of L) expect(wordSet.has(l.form)).toBe(false);
  });
});

describe("inversion round-trip", () => {
  it("entry.relationIds agrees with the relation files in both directions", () => {
    for (const r of R) {
      for (const m of r.members) {
        if (m.kind === "word") {
          expect(W.find((w) => w.word === m.form)?.relationIds).toContain(r.id);
        }
        if (m.kind === "hanzi") {
          expect(H.find((h) => h.char === m.form)?.relationIds).toContain(r.id);
        }
        if (m.kind === "lexeme") {
          expect(L.find((l) => l.form === m.form)?.relationIds).toContain(r.id);
        }
      }
    }
    const byId = new Map(R.map((r) => [r.id, r]));
    for (const w of W) {
      for (const id of w.relationIds) {
        expect(byId.get(id)?.members.some((m) => m.form === w.word)).toBe(true);
      }
    }
    for (const h of H) {
      for (const id of h.relationIds) {
        expect(byId.get(id)?.members.some((m) => m.form === h.char)).toBe(true);
      }
    }
    for (const l of L) {
      for (const id of l.relationIds) {
        expect(byId.get(id)?.members.some((m) => m.form === l.form)).toBe(true);
      }
    }
  });

  it("includes the 什么 / 啥 real-life alternative set", () => {
    const rel = R.find((r) => r.id === "what-question");
    expect(rel?.kind).toBe("register-set");
    expect(rel?.members.map((m) => m.form)).toEqual(["什么", "啥", "干啥"]);
    expect(L.find((l) => l.form === "啥")?.regions).toContain("northern");
    expect(W.find((w) => w.word === "什么")?.relationIds).toContain("what-question");
  });

  it("includes the 怎么 / 咋 real-life alternative set", () => {
    const rel = R.find((r) => r.id === "how-question");
    expect(rel?.kind).toBe("register-set");
    expect(rel?.members.map((m) => m.form)).toEqual(["怎么", "咋", "咋了"]);
    expect(L.find((l) => l.form === "咋")?.relationIds).toContain("how-question");
  });
});

describe("schema guards", () => {
  it("rejects an antonym pair without an axis", () => {
    const parsed = relationFrontmatter.safeParse({
      relation: "bad-pair",
      kind: "antonym-pair",
      label: "Bad",
      confidence: "low",
      members: [
        { form: "上午", kind: "word" },
        { form: "下午", kind: "word" },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
