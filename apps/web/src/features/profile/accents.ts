/**
 * Profile accent presets — a small curated set the user picks from. Stored
 * as the key on the user row; resolved to a hex here so the public page and
 * the OG image share one source of truth. No arbitrary hex input (keeps the
 * page on-brand and avoids validating unbounded color strings).
 */
export const PROFILE_ACCENTS = {
  teal: "#14b8a6",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  rose: "#f43f5e",
  amber: "#f59e0b",
  green: "#22c55e",
} as const;

export type ProfileAccent = keyof typeof PROFILE_ACCENTS;

export const DEFAULT_ACCENT: ProfileAccent = "teal";

/** Resolve a stored accent (preset key OR raw #rrggbb) to a hex color. */
export function accentHex(key: string | undefined): string {
  if (!key) return PROFILE_ACCENTS[DEFAULT_ACCENT];
  if (/^#[0-9a-fA-F]{6}$/.test(key)) return key;
  return (
    PROFILE_ACCENTS[key as ProfileAccent] ?? PROFILE_ACCENTS[DEFAULT_ACCENT]
  );
}

export function isProfileAccent(key: string): key is ProfileAccent {
  return key in PROFILE_ACCENTS;
}

/** True when the stored accent is a custom hex rather than a preset key. */
export function isCustomAccent(key: string | undefined): boolean {
  return typeof key === "string" && /^#[0-9a-fA-F]{6}$/.test(key);
}

export const ACCENT_KEYS = Object.keys(PROFILE_ACCENTS) as ProfileAccent[];
