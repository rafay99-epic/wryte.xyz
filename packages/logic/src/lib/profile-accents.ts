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

export function accentHex(key: string | undefined): string {
  if (!key) return PROFILE_ACCENTS[DEFAULT_ACCENT];
  if (/^#[0-9a-fA-F]{6}$/.test(key)) return key;
  return (
    PROFILE_ACCENTS[key as ProfileAccent] ?? PROFILE_ACCENTS[DEFAULT_ACCENT]
  );
}

export function isCustomAccent(key: string | undefined): boolean {
  return typeof key === "string" && /^#[0-9a-fA-F]{6}$/.test(key);
}

export const ACCENT_KEYS = Object.keys(PROFILE_ACCENTS) as ProfileAccent[];
