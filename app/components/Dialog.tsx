import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { AlertDialog, Dialog } from "radix-ui";

/** Present while a design-system dialog is open (nested Escape/Tab handling). */
export const APP_DIALOG_SELECTOR = "[data-app-dialog]";

const overlayClass = "fixed inset-0 z-[60] bg-ink/45";

const contentClass =
  "fixed top-1/2 left-1/2 z-[61] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-paper p-4 text-ink shadow-2xl outline-none";

const cancelClass =
  "ui-touch inline-flex items-center justify-center rounded-xl border border-line px-4 text-sm text-ink-2 hover:border-accent hover:text-accent";

const confirmClass =
  "ui-touch inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40";

const dangerClass =
  "ui-touch inline-flex items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-paper hover:bg-accent-strong";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  returnFocusRef,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) onOpenChange(false);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="ui-sheet-overlay fixed inset-0 z-60 bg-ink/45 backdrop-blur-[2px] lg:hidden"
          data-app-dialog=""
        />
        <Dialog.Content
          className="ui-sheet-content safe-bottom fixed inset-x-0 bottom-0 z-61 max-h-[min(86dvh,48rem)] overflow-hidden rounded-t-3xl border border-b-0 border-line bg-paper text-ink shadow-2xl outline-none lg:hidden"
          data-app-dialog=""
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
          <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-medium text-ink">{title}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-ink-3">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              aria-label="Close"
              className="ui-touch -mt-1 inline-flex shrink-0 items-center justify-center rounded-full text-2xl leading-none text-ink-3 transition-colors hover:bg-sunk hover:text-ink"
            >
              <span aria-hidden>×</span>
            </Dialog.Close>
          </div>
          <div className="max-h-[calc(86dvh-6.5rem)] overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "neutral" | "danger";
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClass} data-app-dialog="" />
        <AlertDialog.Content
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className={contentClass}
          data-app-dialog=""
        >
          <AlertDialog.Title id={titleId} className="text-base font-medium text-ink">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description
            id={descriptionId}
            className="mt-1.5 text-sm leading-relaxed text-ink-2"
          >
            {description}
          </AlertDialog.Description>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel className={cancelClass}>{cancelLabel}</AlertDialog.Cancel>
            <AlertDialog.Action
              className={tone === "danger" ? dangerClass : confirmClass}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  defaultValue = "",
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = value.replace(/\s+/g, " ").trim();
    if (!next) return;
    onSubmit(next);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} data-app-dialog="" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={contentClass}
          data-app-dialog=""
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
        >
          <Dialog.Title id={titleId} className="text-base font-medium text-ink">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description
              id={descriptionId}
              className="mt-1.5 text-sm leading-relaxed text-ink-2"
            >
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Enter a value.</Dialog.Description>
          )}
          <form onSubmit={submit} className="mt-3">
            <label htmlFor={inputId} className="ui-eyebrow">
              {label}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
              className="ui-touch mt-1.5 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none placeholder:text-ink-3"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Dialog.Close type="button" className={cancelClass}>
                {cancelLabel}
              </Dialog.Close>
              <button type="submit" disabled={!value.trim()} className={confirmClass}>
                {confirmLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
