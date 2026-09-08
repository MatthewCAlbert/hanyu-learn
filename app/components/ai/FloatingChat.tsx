import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LuMessageCircle, LuX } from "react-icons/lu";
import { APP_DIALOG_SELECTOR } from "~/components/Dialog";
import { ChatPanel, chatPanelClass } from "./ChatPanel";
import { startAiPersistence, useAiStore } from "~/lib/ai/store";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const PANEL_SCALE_KEY = "hanyu:chat-panel-scale";
const DEFAULT_SCALE = { width: 380, height: 640 };
const MIN_SCALE = { width: 320, height: 360 };

interface PanelScale {
  width: number;
  height: number;
}

interface ResizeGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startScale: PanelScale;
  nextScale: PanelScale;
  frame: number | null;
}

function normalizedScale(value: unknown): PanelScale | null {
  if (!value || typeof value !== "object") return null;
  const { width, height } = value as Partial<PanelScale>;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    width: Math.max(MIN_SCALE.width, Math.round(width!)),
    height: Math.max(MIN_SCALE.height, Math.round(height!)),
  };
}

function maxViewportScale(): PanelScale {
  return {
    width: Math.max(MIN_SCALE.width, window.innerWidth - 32),
    height: Math.max(MIN_SCALE.height, window.innerHeight - 96),
  };
}

function clampScale(scale: PanelScale): PanelScale {
  const max = maxViewportScale();
  return {
    width: Math.min(Math.max(scale.width, MIN_SCALE.width), max.width),
    height: Math.min(Math.max(scale.height, MIN_SCALE.height), max.height),
  };
}

export function FloatingChat() {
  const ready = useAiStore((s) => s.ready);
  const panelOpen = useAiStore((s) => s.panelOpen);
  const hydrate = useAiStore((s) => s.hydrate);
  const openPanel = useAiStore((s) => s.openPanel);
  const closePanel = useAiStore((s) => s.closePanel);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const resizeGesture = useRef<ResizeGesture | null>(null);
  const [userScale, setUserScale] = useState<PanelScale>(DEFAULT_SCALE);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    void hydrate();
    return startAiPersistence();
  }, [hydrate]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PANEL_SCALE_KEY);
      if (stored) {
        const scale = normalizedScale(JSON.parse(stored));
        if (scale) setUserScale(scale);
      }
    } catch {
      // Ignore unavailable storage and malformed values.
    }
  }, []);

  useEffect(
    () => () => {
      const frame = resizeGesture.current?.frame;
      if (frame != null) cancelAnimationFrame(frame);
    },
    [],
  );

  useEffect(() => {
    if (!panelOpen) return;
    lastFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panelRef.current;
    const focusFirst = () => {
      const composer = root?.querySelector<HTMLElement>("textarea");
      const fallback = root?.querySelector<HTMLElement>("button, a, input");
      (composer ?? fallback)?.focus();
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(APP_DIALOG_SELECTOR)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (fullscreen) setFullscreen(false);
        else closePanel();
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
  }, [panelOpen, closePanel, fullscreen]);

  useEffect(() => {
    if (panelOpen) return;
    lastFocus.current?.focus();
    lastFocus.current = null;
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const mobile = window.matchMedia("(max-width: 639px)");
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const syncOverflow = () => {
      document.documentElement.style.overflow =
        fullscreen || mobile.matches ? "hidden" : htmlOverflow;
      document.body.style.overflow = fullscreen || mobile.matches ? "hidden" : bodyOverflow;
    };
    syncOverflow();
    mobile.addEventListener("change", syncOverflow);
    return () => {
      mobile.removeEventListener("change", syncOverflow);
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [panelOpen, fullscreen]);

  const panelStyle = {
    "--chat-user-width": `${userScale.width}px`,
    "--chat-user-height": `${userScale.height}px`,
  } as CSSProperties;

  const paintResize = (gesture: ResizeGesture, clientX: number, clientY: number) => {
    gesture.nextScale = clampScale({
      width: gesture.startScale.width + gesture.startX - clientX,
      height: gesture.startScale.height + gesture.startY - clientY,
    });
    panelRef.current?.style.setProperty("--chat-user-width", `${gesture.nextScale.width}px`);
    panelRef.current?.style.setProperty("--chat-user-height", `${gesture.nextScale.height}px`);
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (fullscreen || event.button !== 0) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startScale = { width: rect.width, height: rect.height };
    resizeGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScale,
      nextScale: startScale,
      frame: null,
    };
  };

  const onResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = resizeGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const { clientX, clientY } = event;
    if (gesture.frame != null) cancelAnimationFrame(gesture.frame);
    gesture.frame = requestAnimationFrame(() => {
      gesture.frame = null;
      paintResize(gesture, clientX, clientY);
    });
  };

  const finishResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = resizeGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.frame != null) cancelAnimationFrame(gesture.frame);
    paintResize(gesture, event.clientX, event.clientY);
    resizeGesture.current = null;
    setUserScale(gesture.nextScale);
    try {
      sessionStorage.setItem(PANEL_SCALE_KEY, JSON.stringify(gesture.nextScale));
    } catch {
      // The panel remains resizable when session storage is unavailable.
    }
  };

  const onResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const delta =
      event.key === "ArrowLeft"
        ? { width: -step, height: 0 }
        : event.key === "ArrowRight"
          ? { width: step, height: 0 }
          : event.key === "ArrowUp"
            ? { width: 0, height: -step }
            : event.key === "ArrowDown"
              ? { width: 0, height: step }
              : null;
    if (!delta) return;
    event.preventDefault();
    setUserScale((current) => {
      const next = clampScale({
        width: current.width + delta.width,
        height: current.height + delta.height,
      });
      try {
        sessionStorage.setItem(PANEL_SCALE_KEY, JSON.stringify(next));
      } catch {
        // The panel remains resizable when session storage is unavailable.
      }
      return next;
    });
  };

  if (!ready) return null;

  return (
    <>
      <button
        type="button"
        aria-label={panelOpen ? "Close study chat" : "Open study chat"}
        title={panelOpen ? "Close study chat" : "Open study chat"}
        aria-expanded={panelOpen}
        aria-controls={titleId}
        onClick={() => (panelOpen ? closePanel() : openPanel())}
        className={`${panelOpen ? (fullscreen ? "hidden" : "hidden sm:inline-flex") : "inline-flex"} ui-touch fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 size-12 items-center justify-center rounded-full border border-line bg-ink text-paper shadow-lg hover:bg-accent sm:right-4 sm:bottom-4`}
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
        data-fullscreen={fullscreen}
        className={chatPanelClass(panelOpen)}
        style={panelStyle}
      >
        <ChatPanel
          onClose={closePanel}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((value) => !value)}
          resizeHandleProps={{
            onPointerDown: onResizePointerDown,
            onPointerMove: onResizePointerMove,
            onPointerUp: finishResize,
            onPointerCancel: finishResize,
            onKeyDown: onResizeKeyDown,
          }}
        />
      </div>
    </>
  );
}
