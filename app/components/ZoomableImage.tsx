import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { LuZoomIn, LuZoomOut } from "react-icons/lu";

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const BUTTON_STEP = 1.5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 8;

interface View {
  scale: number;
  x: number;
  y: number;
}

const HOME: View = { scale: 1, x: 0, y: 0 };

interface PinchStart {
  dist: number;
  midX: number;
  midY: number;
  view: View;
}

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const iconBtn =
  "ui-touch inline-flex size-11 items-center justify-center rounded-full text-paper hover:bg-paper/15 disabled:opacity-40";

/** Pinch, wheel, double-tap and drag zoom, plus +/- buttons. Offsets are measured from the stage centre. */
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<PinchStart | null>(null);
  const pan = useRef<{ x: number; y: number; view: View } | null>(null);
  const tap = useRef<{ t: number; x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [view, setView] = useState<View>(HOME);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    setView(HOME);
  }, [src]);

  useEffect(() => {
    stage.current?.focus();
  }, []);

  const clamp = useCallback((next: View): View => {
    const box = stage.current;
    const el = img.current;
    if (!box || !el) return next;
    const maxX = Math.max(0, (el.offsetWidth * next.scale - box.clientWidth) / 2);
    const maxY = Math.max(0, (el.offsetHeight * next.scale - box.clientHeight) / 2);
    return {
      scale: next.scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  const center = () => {
    const rect = stage.current?.getBoundingClientRect();
    return {
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    };
  };

  // Zoom keeping the screen point (px, py), measured from the stage centre, fixed.
  const zoomAt = useCallback(
    (from: View, scale: number, px: number, py: number): View => {
      const s = clampScale(scale);
      const ratio = s / from.scale;
      if (s === MIN_SCALE) return HOME;
      return clamp({ scale: s, x: px - (px - from.x) * ratio, y: py - (py - from.y) * ratio });
    },
    [clamp],
  );

  const zoomBy = (factor: number) => setView((v) => zoomAt(v, v.scale * factor, 0, 0));

  const onWheel = (e: WheelEvent) => {
    const c = center();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
    setView((v) => zoomAt(v, v.scale * factor, e.clientX - c.x, e.clientY - c.y));
  };

  const beginPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    const c = center();
    pinch.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      midX: (a.x + b.x) / 2 - c.x,
      midY: (a.y + b.y) / 2 - c.y,
      view: viewRef.current,
    };
    pan.current = null;
    tap.current = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("[data-zoom-control]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      beginPinch();
    } else if (pointers.current.size === 1) {
      pan.current = { x: e.clientX, y: e.clientY, view: viewRef.current };
      tap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY, moved: false };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const start = pinch.current;
    if (pointers.current.size >= 2 && start) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const c = center();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2 - c.x;
      const midY = (a.y + b.y) / 2 - c.y;
      const scale = clampScale(start.view.scale * (dist / start.dist));
      const ratio = scale / start.view.scale;
      setView(
        scale === MIN_SCALE
          ? HOME
          : clamp({
              scale,
              x: midX - (start.midX - start.view.x) * ratio,
              y: midY - (start.midY - start.view.y) * ratio,
            }),
      );
      return;
    }
    const origin = pan.current;
    if (!origin) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (tap.current && Math.hypot(dx, dy) > TAP_SLOP) tap.current.moved = true;
    if (origin.view.scale > MIN_SCALE) {
      setView(clamp({ ...origin.view, x: origin.view.x + dx, y: origin.view.y + dy }));
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const wasTap = tap.current && !tap.current.moved && e.timeStamp - tap.current.t < 400;
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      // Pinch ended with one finger down: continue as a pan from here.
      const [rest] = [...pointers.current.values()];
      if (rest) pan.current = { x: rest.x, y: rest.y, view: viewRef.current };
      return;
    }
    pan.current = null;
    tap.current = null;
    if (!wasTap) return;
    const prev = lastTap.current;
    if (
      prev &&
      e.timeStamp - prev.t < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30
    ) {
      lastTap.current = null;
      const c = center();
      setView((v) =>
        v.scale > MIN_SCALE ? HOME : zoomAt(v, DOUBLE_TAP_SCALE, e.clientX - c.x, e.clientY - c.y),
      );
    } else {
      lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    pan.current = null;
    tap.current = null;
  };

  const percent = Math.round(view.scale * 100);

  return (
    <div
      ref={stage}
      tabIndex={-1}
      role="group"
      aria-label="Image viewer. Pinch, scroll, or double-tap to zoom; drag to pan."
      className="absolute inset-0 touch-none overflow-hidden outline-none select-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") zoomBy(BUTTON_STEP);
        else if (e.key === "-" || e.key === "_") zoomBy(1 / BUTTON_STEP);
        else if (e.key === "0") setView(HOME);
        else if (view.scale > MIN_SCALE && e.key.startsWith("Arrow")) {
          const d = 40;
          const dx = e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0;
          const dy = e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0;
          setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
        } else return;
        e.preventDefault();
      }}
    >
      <div className="flex size-full items-center justify-center p-4">
        <img
          ref={img}
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          className={`max-h-full max-w-full rounded-xl bg-paper object-contain shadow-2xl will-change-transform ${
            view.scale > MIN_SCALE ? "cursor-grab" : "cursor-zoom-in"
          }`}
        />
      </div>
      <div
        data-zoom-control=""
        className="absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto flex w-fit items-center gap-1 rounded-full bg-ink/70 px-1"
      >
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out (-)"
          disabled={view.scale <= MIN_SCALE}
          onClick={() => zoomBy(1 / BUTTON_STEP)}
          className={iconBtn}
        >
          <LuZoomOut className="size-5" />
        </button>
        <button
          type="button"
          aria-label={`Zoom ${percent}%. Reset to fit`}
          title="Reset (0)"
          disabled={view.scale === MIN_SCALE}
          onClick={() => setView(HOME)}
          className="ui-touch min-w-14 rounded-full px-2 text-sm text-paper tabular-nums hover:bg-paper/15 disabled:opacity-100"
        >
          {percent}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in (+)"
          disabled={view.scale >= MAX_SCALE}
          onClick={() => zoomBy(BUTTON_STEP)}
          className={iconBtn}
        >
          <LuZoomIn className="size-5" />
        </button>
      </div>
    </div>
  );
}
