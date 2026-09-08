import { useEffect, useId, useRef, useState } from "react";
import {
  TRANSLATE_IMAGE_MAX_BYTES,
  imageFileFromClipboard,
  type TranslateImage,
} from "~/lib/translate";

export function TranslateImageInput({
  image,
  error,
  disabled,
  onPick,
  onClear,
}: {
  image: TranslateImage | null;
  error?: string | null;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return;
      const file = imageFileFromClipboard(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      onPick(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, onPick]);

  const takeFiles = (list: FileList | null) => {
    const file = list?.[0];
    if (file) onPick(file);
  };

  return (
    <div className="mt-2">
      {image ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <img
            src={image.dataUrl}
            alt={image.name}
            className="max-h-72 w-full object-contain bg-sunk"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <p className="min-w-0 truncate text-xs text-ink-3">
              {image.name} ·{" "}
              {image.bytes < 1024
                ? `${image.bytes} B`
                : `${(image.bytes / 1024).toFixed(image.bytes >= 1024 * 100 ? 0 : 1)} KB`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="ui-touch inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:text-ink disabled:opacity-40"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onClear}
                className="ui-touch inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:text-ink disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled) takeFiles(e.dataTransfer.files);
          }}
          className={
            dragOver
              ? "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-accent bg-accent-soft px-4 py-8 text-center"
              : "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center"
          }
        >
          <span className="text-sm font-medium text-ink">Drop a photo or click to choose</span>
          <span className="mt-1 text-xs text-ink-3">
            PNG, JPEG, or WebP · up to {(TRANSLATE_IMAGE_MAX_BYTES / 1024 / 1024).toFixed(0)} MB ·
            paste with ⌘V
          </span>
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          takeFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
    </div>
  );
}
