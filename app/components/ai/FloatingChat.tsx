import { useEffect, useId, useRef } from "react";
import { LuMessageCircle, LuX } from "react-icons/lu";
import { APP_DIALOG_SELECTOR } from "~/components/Dialog";
import { ChatPanel, chatPanelClass } from "./ChatPanel";
import { startAiPersistence, useAiStore } from "~/lib/ai/store";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FloatingChat() {
  const ready = useAiStore((s) => s.ready);
  const panelOpen = useAiStore((s) => s.panelOpen);
  const hydrate = useAiStore((s) => s.hydrate);
  const openPanel = useAiStore((s) => s.openPanel);
  const closePanel = useAiStore((s) => s.closePanel);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void hydrate();
    return startAiPersistence();
  }, [hydrate]);

  useEffect(() => {
    if (!panelOpen) return;
    lastFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panelRef.current;
    const focusFirst = () => {
      root?.querySelector<HTMLElement>("textarea, button, a, input")?.focus();
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(APP_DIALOG_SELECTOR)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.closest("[inert]"),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [panelOpen, closePanel]);

  useEffect(() => {
    if (panelOpen) return;
    lastFocus.current?.focus();
    lastFocus.current = null;
  }, [panelOpen]);

  if (!ready) return null;

  return (
    <>
      <button
        type="button"
        aria-label={panelOpen ? "Close study chat" : "Open study chat"}
        aria-expanded={panelOpen}
        aria-controls={titleId}
        onClick={() => (panelOpen ? closePanel() : openPanel())}
        className="ui-touch safe-bottom fixed right-3 bottom-3 z-50 inline-flex size-12 items-center justify-center rounded-full border border-line bg-ink text-paper shadow-lg hover:bg-accent sm:right-4 sm:bottom-4"
      >
        {panelOpen ? <LuX className="size-5" /> : <LuMessageCircle className="size-5" />}
      </button>
      <div
        ref={panelRef}
        id={titleId}
        role="dialog"
        aria-label="Study chat"
        aria-modal={panelOpen}
        hidden={!panelOpen}
        inert={!panelOpen}
        className={chatPanelClass(panelOpen)}
      >
        <ChatPanel onClose={closePanel} />
      </div>
    </>
  );
}
