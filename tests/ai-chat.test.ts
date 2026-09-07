import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configInputSchema, maskApiKey, parseConfig } from "~/lib/ai/config";
import { AI_PERSIST, createBlankChat } from "~/lib/ai/store";
import {
  deleteSavedChat,
  getSavedChat,
  listSavedChats,
  putSavedChat,
  resetChatDbForTests,
} from "~/lib/ai/chat-db.client";
import { AGENT_LIMITS, dropCallModelHeader, historyToInput } from "~/lib/ai/agent";
import {
  contextChanged,
  formatUserTurn,
  serializeCompareContext,
  serializeHanziContext,
} from "~/lib/ai/context";
import type { HanziDetailData } from "~/lib/detail-data";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  headers: { headers: { key: string; value: string }[] }[];
};

describe("config", () => {
  it("rejects a non-OpenRouter key", () => {
    expect(configInputSchema.safeParse({ modelName: "x/y", apiKey: "sk-abc" }).success).toBe(false);
    expect(
      configInputSchema.safeParse({ modelName: "anthropic/claude-sonnet-4", apiKey: "sk-or-v1-test" })
        .success,
    ).toBe(true);
  });

  it("masks keys and ignores corrupt storage", () => {
    expect(maskApiKey("sk-or-v1-abcdefghijk")).toMatch(/^sk-or-v…hijk$/);
    expect(parseConfig({ v: 1, modelName: "", apiKey: "x" })).toBeNull();
    expect(
      parseConfig({ v: 1, modelName: "openai/gpt-4o", apiKey: "sk-or-v1-abcdefghijk" }),
    ).toEqual({ modelName: "openai/gpt-4o", apiKey: "sk-or-v1-abcdefghijk" });
  });

  it("rejects unknown config versions instead of silently migrating", () => {
    expect(
      parseConfig({ v: 2, modelName: "openai/gpt-4o", apiKey: "sk-or-v1-abcdefghijk" }),
    ).toBeNull();
    expect(parseConfig({ modelName: "openai/gpt-4o", apiKey: "sk-or-v1-abcdefghijk" })).toBeNull();
  });
});

describe("incognito chats", () => {
  it("start unsaved and do not write to IndexedDB", async () => {
    const chat = createBlankChat();
    expect(chat.saved).toBe(false);
    await expect(putSavedChat(chat)).resolves.toBeUndefined();
    expect(await listSavedChats()).toEqual([]);
  });
});

describe("IndexedDB persistence", () => {
  beforeEach(() => {
    resetChatDbForTests();
  });

  afterEach(() => {
    resetChatDbForTests();
    indexedDB.deleteDatabase("hanyu-ai");
  });

  it("writes only after save, lists, reopens, and deletes", async () => {
    const draft = createBlankChat();
    draft.title = "Incognito";
    draft.messages = [{ id: "m1", role: "user", content: "hello", createdAt: 1 }];
    await putSavedChat(draft);
    expect(await listSavedChats()).toEqual([]);
    expect(await getSavedChat(draft.id)).toBeNull();

    const saved = { ...draft, saved: true, title: "Kept" };
    await putSavedChat(saved);
    expect(await listSavedChats()).toEqual([expect.objectContaining({ id: saved.id, title: "Kept" })]);
    const loaded = await getSavedChat(saved.id);
    expect(loaded?.messages[0]?.content).toBe("hello");
    expect(loaded?.saved).toBe(true);

    await putSavedChat({ ...saved, title: "Updated", updatedAt: saved.updatedAt + 10 });
    expect((await getSavedChat(saved.id))?.title).toBe("Updated");

    await deleteSavedChat(saved.id);
    expect(await listSavedChats()).toEqual([]);
    expect(await getSavedChat(saved.id)).toBeNull();
  });
});

describe("agent limits and CSP", () => {
  it("bounds a run by step count, cost, and tokens", () => {
    expect(AGENT_LIMITS).toEqual({ maxSteps: 6, maxCostUsd: 0.75, maxTokens: 48_000 });
  });

  it("flushes saved chats on a short debounce and interval", () => {
    expect(AI_PERSIST).toEqual({ debounceMs: 2_000, intervalMs: 15_000 });
  });

  it("allows only OpenRouter as an extra connect-src host", () => {
    const csp = vercel.headers
      .flatMap((h) => h.headers)
      .find((h) => h.key === "Content-Security-Policy")?.value;
    expect(csp).toContain("connect-src 'self' https://openrouter.ai");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).not.toMatch(/connect-src[^;]*http:/);
  });
});

describe("browser CORS workaround", () => {
  it("strips the Agent SDK callmodel header before the request is built", () => {
    const next = dropCallModelHeader.beforeCreateRequest(
      {} as never,
      {
        url: new URL("https://openrouter.ai/api/v1/responses"),
        options: {
          headers: {
            Authorization: "Bearer sk-or-v1-test",
            "x-openrouter-callmodel": "true",
          },
        },
      },
    );
    const headers = new Headers(next.options?.headers);
    expect(headers.get("x-openrouter-callmodel")).toBeNull();
    expect(headers.get("Authorization")).toBe("Bearer sk-or-v1-test");
  });

  it("strips the header from an already-built Request", async () => {
    const req = new Request("https://openrouter.ai/api/v1/responses", {
      headers: { "x-openrouter-callmodel": "true", "X-Title": "Hanyu Learn" },
    });
    const next = await dropCallModelHeader.beforeRequest({} as never, req);
    expect(next.headers.get("x-openrouter-callmodel")).toBeNull();
    expect(next.headers.get("X-Title")).toBe("Hanyu Learn");
  });
});

describe("page context snapshots", () => {
  it("only attach when the route identity changes", () => {
    expect(
      contextChanged(undefined, {
        key: "hanzi:好",
        route: "/hanzi/好",
        title: "好",
        kind: "hanzi",
        text: "x",
      }),
    ).toBe(true);
    expect(
      contextChanged("hanzi:好", {
        key: "hanzi:好",
        route: "/hanzi/好",
        title: "好",
        kind: "hanzi",
        text: "x",
      }),
    ).toBe(false);
  });

  it("keeps both compare panes in one identity key", () => {
    const ctx = serializeCompareContext(
      { status: "empty" },
      { status: "missing", ref: { kind: "hanzi", id: "好" } },
      "/compare?right=hanzi:好",
    );
    expect(ctx.kind).toBe("compare");
    expect(ctx.key).toBe("compare:∅|hanzi:好");
    expect(ctx.text).toMatch(/Left: empty/);
    expect(ctx.text).toMatch(/好 is not in the corpus/);
  });

  it("serializes authored etymology separately from mnemonic", () => {
    const data = {
      hanzi: {
        char: "好",
        level: 1,
        readings: [{ pinyin: "hǎo", meanings: ["good"] }],
        pinyin: ["hǎo"],
        meanings: ["good"],
        frequency: 1,
        pos: [],
        traditional: null,
        radical: "女",
        radicalCanonical: "女",
        radicalNumber: 38,
        decomposition: "⿰女子",
        components: ["女", "子"],
        strokeCount: 6,
        etymology: { type: "ideographic", semantic: "女" },
        words: [],
        sentences: [{ id: "1", cmn: "你好。", eng: "Hello." }],
        standards: [],
        topics: [],
        authored: {
          status: "drafted",
          semantic: "女",
          phonetic: null,
          confidence: "high",
          sources: ["Xu Shen"],
          etymology: "Attested compound.",
          mnemonic: "Invented story.",
          notes: null,
        },
      },
      radical: { char: "女", display: "女", gloss: "woman", number: 38, canonical: "女" },
      etymology: { type: "ideographic", semantic: "女" },
      glosses: {},
      componentHrefs: {},
      semanticRole: { form: "女", gloss: "woman", href: "/radicals/女" },
      phoneticRole: null,
      phoneticSeries: [],
      words: [{ word: "爱好", pinyin: "àihào", meaning: "hobby", level: 1, extra: false }],
      topics: [{ id: "people", label: "People" }],
      strokes: { ignored: true },
    } as unknown as HanziDetailData;

    const ctx = serializeHanziContext(data);
    expect(ctx.key).toBe("hanzi:好");
    expect(ctx.text).toMatch(/Etymology \(attested\):\nAttested compound/);
    expect(ctx.text).toMatch(/Mnemonic \(invented, not etymology\):\nInvented story/);
    expect(ctx.text).not.toMatch(/ignored/);
  });

  it("wraps a user turn with page context for the model, not the UI", () => {
    const wrapped = formatUserTurn("why 女?", {
      key: "hanzi:好",
      route: "/hanzi/好",
      title: "好",
      kind: "hanzi",
      text: "Hanzi: 好",
    });
    expect(wrapped).toContain("<page-context");
    expect(wrapped).toContain("why 女?");
    const input = historyToInput([
      {
        id: "1",
        role: "user",
        content: "why 女?",
        createdAt: 1,
        pageContextKey: "hanzi:好",
        pageContextText: "Hanzi: 好",
      },
    ]);
    const first = input[0];
    expect(first && "content" in first && String(first.content)).toContain("Hanzi: 好");
  });
});
