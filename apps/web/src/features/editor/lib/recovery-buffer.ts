/**
 * Local recovery buffer for the editor.
 *
 * Convex mutations in flight when the connection (or tab) dies are simply
 * lost — the autosave toast tells you saving failed, but the words are gone
 * with the tab. This mirrors the dirty buffer into localStorage so the next
 * visit can offer to restore what never reached the server.
 *
 * One entry per save target (document or draft), overwritten in place and
 * deleted the moment the server confirms a save — steady-state storage is
 * zero.
 */

const PREFIX = "wryte:recovery:";
// ponytail: entries above ~2 MB are skipped instead of chunked — localStorage
// quota is 5 MB shared; move to IndexedDB if documents ever get that big.
const MAX_ENTRY_BYTES = 2_000_000;

export type RecoveryEntry = {
  content: string;
  title: string;
  savedAt: number;
};

export function writeRecovery(
  targetId: string,
  content: string,
  title: string,
): void {
  try {
    const serialized = JSON.stringify({
      content,
      title,
      savedAt: Date.now(),
    } satisfies RecoveryEntry);
    if (serialized.length > MAX_ENTRY_BYTES) return;
    localStorage.setItem(PREFIX + targetId, serialized);
  } catch {
    // Quota exhaustion / privacy mode — recovery is best-effort.
  }
}

export function readRecovery(targetId: string): RecoveryEntry | null {
  try {
    const raw = localStorage.getItem(PREFIX + targetId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecoveryEntry>;
    if (typeof parsed.content !== "string" || typeof parsed.title !== "string")
      return null;
    return {
      content: parsed.content,
      title: parsed.title,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearRecovery(targetId: string): void {
  try {
    localStorage.removeItem(PREFIX + targetId);
  } catch {
    // Nothing to do.
  }
}
