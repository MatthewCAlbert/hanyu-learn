import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Route } from "./+types/translate";
import { DetailShell } from "~/components/DetailShell";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { TranslateAiPanel, type TranslateAiStatus } from "~/components/translate/TranslateAiPanel";
import {
  TranslateDocument,
  type DetailMode,
  type TokenSelection,
} from "~/components/translate/TranslateDocument";
import { TranslateImageInput } from "~/components/translate/TranslateImageInput";
import { serializeTranslateContext } from "~/lib/ai/context";
import { checkModelImageInput, hasValidConfig } from "~/lib/ai/config";
import { isAbortError, normalizeAgentError } from "~/lib/ai/errors";
import { useAiStore } from "~/lib/ai/store";
import { loadCompareCatalog } from "~/lib/detail-data";
import { defaultBrowseFallback } from "~/lib/navigation";
import { analyzeText, buildLexicon, translatableBlocks } from "~/lib/segment";
import {
  TRANSLATE_TEXT_MAX,
  capText,
  containsHanzi,
  needsAiForSource,
  readTranslateImage,
  readTranslateQuery,
  type TranslateImage,
} from "~/lib/translate";

type SourceKind = "text" | "image";

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.q?.trim();
  if (!q) return [{ title: "Translate — Mandarin" }];
  const preview = q.length > 16 ? `${q.slice(0, 15)}…` : q;
  return [{ title: `${preview} — Translate` }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const [q, catalog] = await Promise.all([
    Promise.resolve(readTranslateQuery(url.searchParams)),
    loadCompareCatalog(),
  ]);
  return { q, catalog };
}
clientLoader.hydrate = true as const;

export default function TranslatePage({ loaderData }: Route.ComponentProps) {
  const { q, catalog } = loaderData;
  const config = useAiStore((s) => s.config);
  const [sourceKind, setSourceKind] = useState<SourceKind>("text");
  const [draft, setDraft] = useState(q);
  const [committed, setCommitted] = useState(q);
  const [mode, setMode] = useState<DetailMode>("embed");
  const [selected, setSelected] = useState<TokenSelection | null>(null);
  const [textAi, setTextAi] = useState<TranslateAiStatus>({ status: "idle" });
  const [imageAi, setImageAi] = useState<TranslateAiStatus>({ status: "idle" });
  const [image, setImage] = useState<TranslateImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageCommitted, setImageCommitted] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(`translate:${crypto.randomUUID()}`);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setDraft(q);
    setCommitted(q);
    setTextAi({ status: "idle" });
    setSelected(null);
    if (q) setSourceKind("text");
  }, [q]);

  const lexicon = useMemo(
    () => buildLexicon({ hanzi: catalog.hanzi, words: catalog.words }),
    [catalog],
  );
  const cappedDraft = capText(draft);
  const cappedCommitted = capText(committed);
  const textAnalysis = useMemo(
    () => analyzeText(cappedCommitted.text, lexicon),
    [cappedCommitted.text, lexicon],
  );
  const imageAnalysis = useMemo(
    () => (imageCommitted ? analyzeText(imageCommitted, lexicon) : null),
    [imageCommitted, lexicon],
  );
  const analysis = sourceKind === "image" ? (imageAnalysis ?? textAnalysis) : textAnalysis;
  const hasLocalBreakdown =
    sourceKind === "image"
      ? Boolean(imageAnalysis && translatableBlocks(imageAnalysis).length > 0)
      : translatableBlocks(textAnalysis).length > 0;
  const canSubmitText = cappedDraft.text.trim().length > 0;
  const ai = sourceKind === "image" ? imageAi : textAi;
  const contextText = sourceKind === "image" ? imageCommitted : cappedCommitted.text;

  const context = useMemo(
    () => serializeTranslateContext(contextText, analysis, "/translate"),
    [contextText, analysis],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const generateText = async (source: string) => {
    const next = capText(source).text;
    if (!next.trim()) return;
    if (!hasValidConfig(config)) {
      setTextAi({
        status: "error",
        message: "Add a model and API key in Settings to translate.",
        tools: [],
      });
      return;
    }
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const nextAnalysis = analyzeText(next, lexicon);
    setTextAi({ status: "running", tools: [] });
    try {
      const { runTranslateAgent } = await import("~/lib/ai/translate");
      const result = await runTranslateAgent({
        config,
        sessionId: sessionRef.current,
        analysis: nextAnalysis,
        lexicon,
        signal: abort.signal,
        onTools: (tools) => {
          setTextAi((prev) => (prev.status === "running" ? { status: "running", tools } : prev));
        },
      });
      if (abortRef.current !== abort) return;
      if (result.sourceText !== next) {
        setDraft(result.sourceText);
        setCommitted(result.sourceText);
      }
      setTextAi({
        status: "done",
        result: result.bound,
        usage: result.usage,
        tools: result.tools,
      });
    } catch (err) {
      if (abortRef.current !== abort) return;
      const message = isAbortError(err) ? "Stopped." : normalizeAgentError(err);
      setTextAi({ status: "error", message, tools: [] });
    }
  };

  const generateImage = async (next: TranslateImage) => {
    if (!hasValidConfig(config)) {
      setImageAi({
        status: "error",
        message: "Add a model and API key in Settings to translate images.",
        tools: [],
      });
      return;
    }
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setImageAi({ status: "running", tools: [] });
    try {
      const vision = await checkModelImageInput(config, abort.signal);
      if (!vision.ok) {
        if (abortRef.current !== abort) return;
        setImageAi({ status: "error", message: vision.error, tools: [] });
        return;
      }
      const { runTranslateImageAgent } = await import("~/lib/ai/translate");
      const result = await runTranslateImageAgent({
        config,
        sessionId: sessionRef.current,
        imageUrl: next.dataUrl,
        lexicon,
        signal: abort.signal,
        onTools: (tools) => {
          setImageAi((prev) => (prev.status === "running" ? { status: "running", tools } : prev));
        },
      });
      if (abortRef.current !== abort) return;
      setImageCommitted(result.sourceText);
      setImageAi({
        status: "done",
        result: result.bound,
        usage: result.usage,
        tools: result.tools,
      });
    } catch (err) {
      if (abortRef.current !== abort) return;
      const message = isAbortError(err) ? "Stopped." : normalizeAgentError(err);
      setImageAi({ status: "error", message, tools: [] });
    }
  };

  const commitText = (runAi: boolean) => {
    const next = capText(draft).text;
    if (!next.trim() || textAi.status === "running") return;
    const changed = next !== committed;
    setCommitted(next);
    setSelected(null);
    const useAi = runAi || needsAiForSource(next);
    if (changed && !useAi) {
      abortRef.current?.abort();
      abortRef.current = null;
      setTextAi({ status: "idle" });
    }
    if (useAi) void generateText(next);
  };

  const pickImage = (file: File) => {
    void (async () => {
      const read = await readTranslateImage(file, file.name || "image");
      if (!read.ok) {
        setImageError(read.error);
        return;
      }
      setImageError(null);
      setImage(read.image);
      setSelected(null);
      setImageCommitted("");
      void generateImage(read.image);
    })();
  };

  const clearImage = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setImage(null);
    setImageError(null);
    setImageCommitted("");
    setImageAi({ status: "idle" });
    setSelected(null);
  };

  const translations = ai.status === "done" ? ai.result.paragraphs : null;
  const showDocument = hasLocalBreakdown || Boolean(translations);

  return (
    <>
      <PageContextBridge context={context} />
      <DetailShell current="Translate" fallback={defaultBrowseFallback("hanzi")}>
        <fieldset className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
          <legend className="sr-only">Source kind</legend>
          {(
            [
              ["text", "Text"],
              ["image", "Image"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sourceKind === value}
              onClick={() => {
                if (sourceKind === value) return;
                abortRef.current?.abort();
                abortRef.current = null;
                if (textAi.status === "running") setTextAi({ status: "idle" });
                if (imageAi.status === "running") setImageAi({ status: "idle" });
                setSourceKind(value);
                setSelected(null);
              }}
              className={clsx(
                "ui-touch min-w-20 rounded-lg px-3 text-sm font-medium",
                sourceKind === value ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>

        {sourceKind === "text" ? (
          <>
            <label className="mt-4 block">
              <span className="ui-eyebrow">Source</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.key === "Process") return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitText(false);
                  }
                }}
                rows={6}
                maxLength={TRANSLATE_TEXT_MAX}
                spellCheck={false}
                placeholder="Paste Chinese, pinyin, or a sentence…"
                className="ui-touch mt-2 min-h-32 w-full rounded-xl border border-line bg-surface px-3 py-3 text-base leading-7 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">
                {cappedDraft.truncated
                  ? `Showing the first ${TRANSLATE_TEXT_MAX.toLocaleString()} characters.`
                  : `${draft.length.toLocaleString()} / ${TRANSLATE_TEXT_MAX.toLocaleString()}`}
                <span className="text-ink-3">
                  {needsAiForSource(draft)
                    ? " · Enter to translate with AI · Shift+Enter for a new line"
                    : " · Enter to analyze · Shift+Enter for a new line"}
                </span>
              </p>
              <OpenModeToggle mode={mode} onChange={setMode} />
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <span className="ui-eyebrow">Source</span>
              <TranslateImageInput
                image={image}
                error={imageError}
                disabled={imageAi.status === "running"}
                onPick={pickImage}
                onClear={clearImage}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">Choosing or pasting an image translates it with AI.</p>
              <OpenModeToggle mode={mode} onChange={setMode} />
            </div>
          </>
        )}

        <div className="mt-6">
          <TranslateAiPanel
            state={ai}
            variant={sourceKind}
            disabled={sourceKind === "image" ? !image : !canSubmitText}
            onGenerate={() => {
              if (sourceKind === "image") {
                if (image) void generateImage(image);
                return;
              }
              commitText(true);
            }}
            onStop={stop}
          />
        </div>

        <div className="mt-8">
          {showDocument ? (
            <TranslateDocument
              analysis={analysis}
              mode={mode}
              selected={selected}
              onSelect={setSelected}
              translations={translations}
            />
          ) : ai.status === "running" || (sourceKind === "image" && image) ? null : (
            <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-12 text-center text-sm text-ink-3">
              {sourceKind === "image"
                ? "Choose or paste an image. Extracted Chinese will split into clickable words."
                : needsAiForSource(draft)
                  ? "Press Enter to translate this with AI. The result will be split into clickable words."
                  : containsHanzi(draft)
                    ? "Press Enter to analyze this text against the corpus."
                    : "Paste Chinese or pinyin, then press Enter."}
            </p>
          )}
        </div>
      </DetailShell>
    </>
  );
}

function OpenModeToggle({
  mode,
  onChange,
}: {
  mode: DetailMode;
  onChange: (next: DetailMode) => void;
}) {
  return (
    <fieldset className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
      <legend className="sr-only">Open entries</legend>
      {(
        [
          ["embed", "Embed"],
          ["direct", "Direct"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={clsx(
            "ui-touch min-w-20 rounded-lg px-3 text-sm font-medium",
            mode === value ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
