import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import type { CharacterJson } from "hanzi-writer";

/**
 * Wrapper around hanzi-writer, which is imperative and mutates the DOM.
 *
 * Keyed on `char` by the caller so navigating between characters tears the
 * writer down rather than layering a second one into the same node. Stroke
 * data is passed in from the loader — the library's own network fetch is
 * disabled, since we ship only the 598 characters we need.
 */
export function StrokeOrder({ char, data }: { char: string; data: CharacterJson | null }) {
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const [ready, setReady] = useState(false);

  // `data` arrives from the loader and gets a fresh object identity on every
  // render, so the effect keys on `char` alone — otherwise any re-render tears
  // the writer down mid-animation and the character never finishes drawing.
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    const node = target.current;
    const charData = latest.current;
    if (!node || !charData) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim();
    const line = getComputedStyle(document.documentElement).getPropertyValue("--color-line").trim();
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim();

    const w = HanziWriter.create(node, char, {
      width: 220,
      height: 220,
      padding: 12,
      strokeColor: ink || "#1c1a17",
      radicalColor: accent || "#c8442e",
      outlineColor: line || "#e3dfd8",
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 180,
      charDataLoader: () => charData,
    });
    writer.current = w;
    setReady(true);

    // Autoplay once on arrival. With reduced motion we still render the finished
    // character — skipping the animation must not leave a blank outline.
    if (reduced) w.showCharacter();
    else w.animateCharacter();

    return () => {
      w.hideCharacter();
      writer.current = null;
      node.innerHTML = "";
      setReady(false);
    };
  }, [char]);

  if (!data) {
    return (
      <div className="flex size-[220px] items-center justify-center rounded-lg border border-dashed border-line">
        <span className="han text-6xl text-ink-3">{char}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={target}
        className="rounded-lg border border-line bg-surface"
        style={{ width: 220, height: 220 }}
      />
      <div className="flex gap-1.5">
        <Btn disabled={!ready} onClick={() => writer.current?.animateCharacter()}>
          Play
        </Btn>
        <Btn disabled={!ready} onClick={() => writer.current?.loopCharacterAnimation()}>
          Loop
        </Btn>
        <Btn
          disabled={!ready}
          onClick={() => {
            writer.current?.pauseAnimation();
            writer.current?.showCharacter();
          }}
        >
          Stop
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}
