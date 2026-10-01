export const SCOPES = {
  read: "wryte:read",
  write: "wryte:write",
  media: "wryte:media",
  trash: "wryte:trash",
  notes: "wryte:notes",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: readonly Scope[] = Object.values(SCOPES);

export const DEFAULT_GRANT: readonly Scope[] = [
  SCOPES.read,
  SCOPES.write,
  SCOPES.notes,
];

export function currentScopes(stored: readonly string[] | undefined): Scope[] {
  if (stored === undefined) return [...DEFAULT_GRANT];
  return ALL_SCOPES.filter((scope) => stored.includes(scope));
}

export type WryteToolMetadata = {
  scopes: readonly [Scope, ...Scope[]];
  auditArgs?: false | { redact: string[] };
};
