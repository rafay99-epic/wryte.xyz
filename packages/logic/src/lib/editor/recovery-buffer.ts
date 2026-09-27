const PREFIX = "wryte:recovery:";
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
  } catch {}
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
  } catch {}
}
