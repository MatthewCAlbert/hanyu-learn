import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { LuLoader, LuSquare, LuVolume2, LuVolumeX } from "react-icons/lu";
import { subscribePronunciation } from "~/lib/pronunciation.events";

type ButtonState = "idle" | "loading" | "playing" | "unavailable";

/**
 * Header play control. Audio, the player module, and clip bytes all load on
 * the first click — render is a 44px button.
 */
export function PronunciationButton({
  form,
  pinyin,
  preferWordClip,
}: {
  form: string;
  pinyin: string;
  preferWordClip: boolean;
}) {
  const reactId = useId();
  const [state, setState] = useState<ButtonState>("idle");

  useEffect(() => {
    return subscribePronunciation((status) => {
      setState((prev) => {
        if (status.id === reactId && status.phase === "playing") return "playing";
        if (status.id && status.id !== reactId && (prev === "playing" || prev === "loading")) {
          return "idle";
        }
        if (!status.id && status.phase === "idle" && prev === "playing") return "idle";
        return prev;
      });
    });
  }, [reactId]);

  const label =
    state === "playing"
      ? `Stop pronunciation of ${form}`
      : state === "unavailable"
        ? `Pronunciation unavailable for ${form}`
        : `Play pronunciation of ${form}, ${pinyin}`;

  async function onClick() {
    const player = await import("~/lib/pronunciation.player");
    if (state === "playing" || state === "loading") {
      player.stopPronunciation();
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const result = await player.playPronunciation({
        id: reactId,
        form,
        pinyin,
        preferWordClip,
      });
      if (result === "unavailable") setState("unavailable");
    } catch {
      setState("unavailable");
    }
  }

  const Icon =
    state === "loading"
      ? LuLoader
      : state === "playing"
        ? LuSquare
        : state === "unavailable"
          ? LuVolumeX
          : LuVolume2;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      aria-label={label}
      title={label}
      aria-pressed={state === "playing"}
      className={clsx(
        "ui-touch inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-accent hover:text-accent",
        state === "playing" && "border-accent text-accent",
        state === "unavailable" && "opacity-50",
      )}
    >
      <Icon
        aria-hidden="true"
        className={clsx("size-4", state === "loading" && "motion-safe:animate-spin")}
      />
    </button>
  );
}
