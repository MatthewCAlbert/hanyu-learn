const link = "underline underline-offset-2 hover:text-accent";

/**
 * Licence attribution required on distribution. Quiet on purpose — it has to
 * be in the UI, not in the way. The full text lives on `/credits`.
 */
export function CreditsFooter() {
  return (
    <footer className="mt-auto border-t border-line px-4 py-3 text-[11px] leading-relaxed text-ink-3 lg:px-6">
      <p>
        Sentences from{" "}
        <a href="https://tatoeba.org" target="_blank" rel="noreferrer" className={link}>
          Tatoeba
        </a>{" "}
        (CC-BY 2.0 FR). Decompositions from{" "}
        <a
          href="https://github.com/skishore/makemeahanzi"
          target="_blank"
          rel="noreferrer"
          className={link}
        >
          Make Me a Hanzi
        </a>{" "}
        (LGPL-3.0). Stroke order from{" "}
        <a
          href="https://github.com/chanind/hanzi-writer-data"
          target="_blank"
          rel="noreferrer"
          className={link}
        >
          hanzi-writer-data
        </a>{" "}
        (Arphic Public License).{" "}
        <a href="/credits" className={link}>
          Credits
        </a>
      </p>
    </footer>
  );
}
