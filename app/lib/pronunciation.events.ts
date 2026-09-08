/**
 * Tiny playback bus so the header button can subscribe without loading Web Audio.
 */
export type PronunciationStatus = { id: string | null; phase: "idle" | "playing" };

let status: PronunciationStatus = { id: null, phase: "idle" };
const listeners = new Set<(next: PronunciationStatus) => void>();

export function getPronunciationStatus(): PronunciationStatus {
  return status;
}

export function emitPronunciation(next: PronunciationStatus) {
  status = next;
  for (const listener of listeners) listener(next);
}

export function subscribePronunciation(listener: (next: PronunciationStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}
