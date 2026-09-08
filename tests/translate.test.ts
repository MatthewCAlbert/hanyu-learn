import { describe, expect, it } from "vitest";
import {
  bindImageTranslation,
  bindTranslationResult,
  extractImageTranslationPayload,
  extractTranslationPayload,
  failTranslate,
  imageTranslationInput,
  parseSubmitImageTranslation,
  parseSubmitTranslation,
  translationPrompt,
} from "~/lib/ai/translate";
import { analyzeText, buildLexicon } from "~/lib/segment";
import { modelAcceptsImageInput } from "~/lib/ai/config";
import {
  browseSearchEmpty,
  capText,
  containsHanzi,
  hanziCount,
  isAllowedTranslateImageType,
  isExactCorpusEntry,
  needsAiForSource,
  readTranslateImage,
  readTranslateQuery,
  shouldSuggestTranslate,
  sniffImageMime,
  translateHref,
  TRANSLATE_IMAGE_MAX_BYTES,
  TRANSLATE_QUERY_MAX,
  TRANSLATE_TEXT_MAX,
} from "~/lib/translate";

const lexicon = buildLexicon({
  hanzi: [
    { char: "我", pinyin: ["wǒ"], meanings: ["I"], level: 1 },
    { char: "好", pinyin: ["hǎo"], meanings: ["good"], level: 1 },
    { char: "你", pinyin: ["nǐ"], meanings: ["you"], level: 1 },
  ],
  words: [
    { word: "你好", pinyin: "nǐhǎo", meanings: ["hello"], level: 1, extra: false },
    { word: "我", pinyin: "wǒ", meanings: ["I"], level: 1, extra: false },
  ],
});

const shownEmpty = { hanzi: 0, words: 0, topics: 0, radicals: 0, phonetics: 0 };

describe("translate URLs and caps", () => {
  it("seeds a bookmarkable ?q= and leaves blank at /translate", () => {
    expect(translateHref("")).toBe("/translate");
    expect(translateHref("  你好  ")).toBe(`/translate?${new URLSearchParams({ q: "你好" })}`);
    expect(readTranslateQuery(new URLSearchParams("q=你好"))).toBe("你好");
    expect(readTranslateQuery(new URLSearchParams())).toBe("");
  });

  it("caps URL seeds and textarea pastes separately", () => {
    const long = "你".repeat(TRANSLATE_QUERY_MAX + 20);
    const href = translateHref(long);
    expect(href.startsWith("/translate?")).toBe(true);
    expect(new URL(href, "https://hanyu.invalid").searchParams.get("q")?.length).toBe(TRANSLATE_QUERY_MAX);
    const over = "a".repeat(TRANSLATE_TEXT_MAX + 10);
    expect(capText(over)).toEqual({
      text: over.slice(0, TRANSLATE_TEXT_MAX),
      truncated: true,
    });
  });
});

describe("search suggestion eligibility", () => {
  const catalog = {
    hanzi: [{ char: "好" }],
    words: [{ word: "你好" }],
  };

  it("offers translate for sentences and unknown glyphs, not exact entries", () => {
    expect(containsHanzi("hao")).toBe(false);
    expect(shouldSuggestTranslate("hao", true, false)).toBe(false);
    expect(browseSearchEmpty(shownEmpty)).toBe(true);
    expect(shouldSuggestTranslate("我喜欢学习中文", false, false)).toBe(true);
    expect(shouldSuggestTranslate("好", true, isExactCorpusEntry(catalog, "好"))).toBe(false);
    expect(shouldSuggestTranslate("你好", false, isExactCorpusEntry(catalog, "你好"))).toBe(false);
    expect(shouldSuggestTranslate("好", false, false)).toBe(false);
    expect(hanziCount("我喜欢")).toBe(3);
    expect(needsAiForSource("women qu nar?")).toBe(true);
    expect(needsAiForSource("我喜欢学习中文")).toBe(false);
    expect(needsAiForSource("   ")).toBe(false);
  });
});

describe("AI translation validation", () => {
  const analysis = analyzeText("你好\n\n我", lexicon);

  it("builds a prompt with stable paragraph and span ids", () => {
    const prompt = translationPrompt(analysis);
    expect(prompt).toContain("Paragraph p0:");
    expect(prompt).toContain("Paragraph p2:");
    expect(prompt).not.toContain("Paragraph p1:");
    expect(prompt).toContain("p0.s0");
    expect(prompt).toContain("「你好」");
  });

  it("binds paragraph-aligned translations and notes", () => {
    const parsed = parseSubmitTranslation({
      paragraphs: [
        { id: "p0", translation: "Hello", notes: [{ spanId: "p0.s0", text: "greeting" }] },
        { id: "p2", translation: "I" },
      ],
    });
    expect(parsed).not.toBeNull();
    const bound = bindTranslationResult(analysis, parsed!);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.result.paragraphs.map((p) => p.id)).toEqual(["p0", "p2"]);
    expect(bound.result.paragraphs[0]?.notes[0]?.span?.text).toBe("你好");
  });

  it("rejects unknown paragraph and span ids", () => {
    expect(
      bindTranslationResult(analysis, {
        paragraphs: [{ id: "px", translation: "Nope" }],
      }).ok,
    ).toBe(false);
    expect(
      bindTranslationResult(analysis, {
        paragraphs: [
          { id: "p0", translation: "Hello", notes: [{ spanId: "p9.s0", text: "nope" }] },
          { id: "p2", translation: "I" },
        ],
      }),
    ).toMatchObject({ ok: false, error: "Unknown span id: p9.s0" });
  });

  it("rejects a missing translatable paragraph", () => {
    const bound = bindTranslationResult(analysis, {
      paragraphs: [{ id: "p0", translation: "Hello" }],
    });
    expect(bound).toMatchObject({ ok: false, error: "Missing translation for p2" });
  });

  it("reads the last submit_translation tool payload", () => {
    expect(
      extractTranslationPayload([
        { name: "lookup_word", args: { word: "你好" } },
        {
          name: "submit_translation",
          args: { paragraphs: [{ id: "p0", translation: "Hello" }] },
        },
      ]),
    ).toEqual({ paragraphs: [{ id: "p0", translation: "Hello" }] });
    expect(extractTranslationPayload([{ name: "lookup_hanzi", args: { char: "好" } }])).toBeNull();
  });

  it("requires chinese when the source is pinyin or other freeform", () => {
    const freeform = analyzeText("women qu nar?", lexicon);
    expect(translationPrompt(freeform)).toContain("No Hanzi on this line");
    expect(
      bindTranslationResult(freeform, {
        paragraphs: [{ id: "p0", translation: "Where are we going?" }],
      }),
    ).toMatchObject({ ok: false, error: "Missing chinese for p0" });
    const bound = bindTranslationResult(
      freeform,
      {
        paragraphs: [
          {
            id: "p0",
            chinese: "我们去哪儿？",
            translation: "Where are we going?",
          },
        ],
      },
      lexicon,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.sourceText).toBe("我们去哪儿？");
    expect(bound.analysis.blocks[0]?.spans.some((s) => s.kind === "word" || s.kind === "hanzi")).toBe(
      true,
    );
    expect(bound.result.paragraphs[0]?.translation).toBe("Where are we going?");
  });

  it("maps abort vs other failures", () => {
    expect(failTranslate(new DOMException("aborted", "AbortError"))).toEqual({
      reason: "stopped",
      message: "Stopped.",
    });
    expect(failTranslate(new Error("401 Unauthorized"))).toEqual({
      reason: "error",
      message: "OpenRouter rejected the API key. Check it in Settings.",
    });
  });
});

describe("image translation", () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("accepts PNG, JPEG, and WebP and sniffs missing types", () => {
    expect(isAllowedTranslateImageType("image/png")).toBe(true);
    expect(isAllowedTranslateImageType("image/jpg")).toBe(true);
    expect(isAllowedTranslateImageType("image/gif")).toBe(false);
    expect(sniffImageMime(pngHeader)).toBe("image/png");
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffImageMime(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
  });

  it("reads a small PNG into a data URL and rejects oversize or empty files", async () => {
    const file = new File([pngHeader], "sign.png", { type: "image/png" });
    const read = await readTranslateImage(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.image.mime).toBe("image/png");
    expect(read.image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(read.image.name).toBe("sign.png");
    expect(
      await readTranslateImage({
        size: TRANSLATE_IMAGE_MAX_BYTES + 1,
        type: "image/png",
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Blob),
    ).toMatchObject({ ok: false, error: "Images must be 10 MB or smaller." });
    expect(await readTranslateImage(new Blob([], { type: "image/png" }))).toMatchObject({
      ok: false,
      error: "That image is empty.",
    });
    expect(
      await readTranslateImage(new File([new Uint8Array([1, 2, 3])], "x.gif", { type: "image/gif" })),
    ).toMatchObject({ ok: false, error: "Use a PNG, JPEG, or WebP image." });
  });

  it("builds a multimodal user message with the image data URL", () => {
    const input = imageTranslationInput("data:image/png;base64,abc");
    const user = input[0] as {
      role: string;
      content: { type: string; text?: string; imageUrl?: string; detail?: string }[];
    };
    expect(user.role).toBe("user");
    expect(user.content).toEqual([
      { type: "input_text", text: expect.stringContaining("submit_image_translation") },
      { type: "input_image", imageUrl: "data:image/png;base64,abc", detail: "high" },
    ]);
  });

  it("binds extracted Chinese in visual order and segments it", () => {
    const bound = bindImageTranslation(
      {
        paragraphs: [
          { chinese: "你好", translation: "Hello" },
          { chinese: "我", translation: "I", notes: [{ text: "first person" }] },
        ],
      },
      lexicon,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.sourceText).toBe("你好\n我");
    expect(bound.result.paragraphs.map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(bound.result.paragraphs[0]?.translation).toBe("Hello");
    expect(bound.result.paragraphs[1]?.notes[0]).toEqual({ text: "first person" });
    expect(bound.analysis.blocks[0]?.spans.some((s) => s.kind === "word" || s.kind === "hanzi")).toBe(
      true,
    );
  });

  it("rejects empty or non-Chinese image payloads", () => {
    expect(
      parseSubmitImageTranslation({
        paragraphs: [{ chinese: "你好", translation: "Hello" }],
      }),
    ).toEqual({ paragraphs: [{ chinese: "你好", translation: "Hello" }] });
    expect(
      bindImageTranslation({ paragraphs: [{ chinese: "", translation: "Nothing here" }] }, lexicon),
    ).toMatchObject({ ok: false, error: "No Chinese was found in this image." });
    expect(
      bindImageTranslation({ paragraphs: [{ chinese: "hello", translation: "hello" }] }, lexicon),
    ).toMatchObject({ ok: false, error: "No Chinese was found in this image." });
    expect(
      extractImageTranslationPayload([
        { name: "lookup_hanzi", args: { char: "好" } },
        {
          name: "submit_image_translation",
          args: { paragraphs: [{ chinese: "好", translation: "good" }] },
        },
      ]),
    ).toEqual({ paragraphs: [{ chinese: "好", translation: "good" }] });
    expect(extractImageTranslationPayload([{ name: "submit_translation", args: {} }])).toBeNull();
  });

  it("detects vision-capable models from OpenRouter modality metadata", () => {
    expect(
      modelAcceptsImageInput({
        id: "openai/gpt-4o",
        architecture: { input_modalities: ["text", "image"] },
      }),
    ).toBe(true);
    expect(
      modelAcceptsImageInput({
        architecture: { input_modalities: [{ type: "text" }, { type: "image" }] },
      }),
    ).toBe(true);
    expect(modelAcceptsImageInput({ architecture: { input_modalities: ["text"] } })).toBe(false);
    expect(modelAcceptsImageInput({ id: "some/model" })).toBe(false);
  });
});
