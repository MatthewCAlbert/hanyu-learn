import { DetailShell } from "~/components/DetailShell";
import { defaultBrowseFallback } from "~/lib/navigation";

export function meta() {
  return [{ title: "Credits — Mandarin" }];
}

export default function Credits() {
  return (
    <DetailShell current="Credits" fallback={defaultBrowseFallback()}>
      <h1 className="text-xl font-medium">Credits</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        This app is built from open data. Three sources require attribution on distribution; they
        are named below in the form each licence asks for.
      </p>

      <section className="mt-8 border-t border-line pt-5">
        <h2 className="ui-eyebrow">Tatoeba</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Example sentences come from <Ext href="https://tatoeba.org">Tatoeba</Ext>, licensed under{" "}
          <Ext href="https://creativecommons.org/licenses/by/2.0/fr/">CC-BY 2.0 FR</Ext>. The export
          is joined (Chinese–English) and pruned so a sentence never uses a character above its
          entry's HSK level.
        </p>
      </section>

      <section className="mt-8 border-t border-line pt-5">
        <h2 className="ui-eyebrow">Make Me a Hanzi</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Character decompositions, written radical forms, and etymology types come from{" "}
          <Ext href="https://github.com/skishore/makemeahanzi">skishore/makemeahanzi</Ext>{" "}
          <code className="rounded bg-sunk px-1 text-[0.9em]">dictionary.txt</code>, licensed under{" "}
          <Ext href="https://www.gnu.org/licenses/lgpl-3.0.html">LGPL-3.0-or-later</Ext>. That
          project derives from Unihan and CJKlib. The copy in{" "}
          <code className="rounded bg-sunk px-1 text-[0.9em]">data/sources/</code> is vendored
          unmodified.
        </p>
      </section>

      <section className="mt-8 border-t border-line pt-5">
        <h2 className="ui-eyebrow">hanzi-writer-data</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Stroke-order graphics come from{" "}
          <Ext href="https://github.com/chanind/hanzi-writer-data">hanzi-writer-data</Ext>,
          extracted from the Arphic PL KaitiM GB font. Redistributed under the{" "}
          <Ext href="/licenses/ARPHICPL.TXT">Arphic Public License</Ext>. The stroke files are used
          as published; no glyphs have been modified.
        </p>
      </section>

      <section className="mt-8 border-t border-line pt-5">
        <h2 className="ui-eyebrow">Also used</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            HSK word lists from{" "}
            <Ext href="https://github.com/drkameleon/complete-hsk-vocabulary">
              complete-hsk-vocabulary
            </Ext>{" "}
            (MIT).
          </li>
          <li>
            Canonical radical numbers from{" "}
            <Ext href="https://www.unicode.org/charts/unihan.html">Unicode Unihan</Ext> (Unicode
            License).
          </li>
          <li>
            Gloss text traces back to{" "}
            <Ext href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict">CC-CEDICT</Ext>{" "}
            (CC-BY-SA 3.0) through the HSK wordlist.
          </li>
        </ul>
      </section>
    </DetailShell>
  );
}

function Ext({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline underline-offset-2"
    >
      {children}
    </a>
  );
}
