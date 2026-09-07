import { useEffect } from "react";
import { useAiStore } from "~/lib/ai/store";
import type { PageContext } from "~/lib/ai/types";

/** Registers the open page as chat context; clears on unmount. */
export function PageContextBridge({ context }: { context: PageContext }) {
  const setPageContext = useAiStore((s) => s.setPageContext);

  useEffect(() => {
    setPageContext(context);
    return () => setPageContext(null);
  }, [context, setPageContext]);

  return null;
}
