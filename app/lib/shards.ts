/**
 * Hash-bucket helpers shared by the dataset build and the browser loader.
 * Same function, same bucket count, so a detail URL always hits the file
 * that actually contains that entry.
 */
export const SHARD_BUCKETS = 64;

/** FNV-1a over UTF-16 code units. Stable across Node and the browser. */
export function shardBucket(key: string, buckets = SHARD_BUCKETS): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % buckets;
}
