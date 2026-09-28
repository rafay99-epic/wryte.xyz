export const SCOPES = {
  read: "wryte:read",
  write: "wryte:write",
  media: "wryte:media",
  trash: "wryte:trash",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: readonly Scope[] = Object.values(SCOPES);

export const DEFAULT_GRANT: readonly Scope[] = [SCOPES.read, SCOPES.write];

export type WryteToolMetadata = {
  scopes: readonly [Scope, ...Scope[]];
  auditArgs?: false | { redact: string[] };
};
