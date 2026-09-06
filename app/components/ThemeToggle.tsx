import { useEffect, useState } from "react";

/** Light/dark override, persisted per browser. Defaults to the system setting. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* private mode: fall back to the system setting */
    }
  }, []);

  const cycle = () => {
    const next =
      theme === "dark" ? "light" : theme === "light" ? null : ("dark" as "light" | "dark" | null);
    setTheme(next);
    try {
      if (next) {
        localStorage.setItem("theme", next);
        document.documentElement.dataset.theme = next;
      } else {
        localStorage.removeItem("theme");
        delete document.documentElement.dataset.theme;
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${theme ?? "system"}`}
      aria-label={`Theme: ${theme ?? "system"}. Click to change.`}
      className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:text-accent"
    >
      {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
    </button>
  );
}
