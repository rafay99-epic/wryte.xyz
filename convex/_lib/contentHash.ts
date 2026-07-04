/**
 * Cheap, dependency-free content fingerprint (FNV-1a, 32-bit, hex).
 *
 * Used to dedup version snapshots without reading the previous snapshot's
 * full body back from the database — Convex bills every read at full row
 * size, so comparing hashes stored on the small metadata row is the only
 * way to answer "did the content change?" for free.
 *
 * Not cryptographic and doesn't need to be: a collision merely skips one
 * safety-net snapshot, and callers may additionally compare lengths
 * (`content.length`) to make accidental collisions vanishingly unlikely.
 */
export function contentHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 coerces to unsigned; length suffix hardens against collisions.
  return `${(hash >>> 0).toString(16)}-${String(content.length)}`;
}
