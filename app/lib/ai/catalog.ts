import { loadCompareCatalog, type CompareCatalog } from "~/lib/detail-data";

let catalogPromise: Promise<CompareCatalog> | null = null;

export function loadAiCatalog(): Promise<CompareCatalog> {
  catalogPromise ??= loadCompareCatalog();
  return catalogPromise;
}
