/**
 * Capability model for the MCP server.
 *
 * ## Why these are not OAuth scopes
 *
 * The original design put these in the OAuth token's `scope` claim, so the
 * Clerk consent screen would be the grant UI. That doesn't work today:
 * **Clerk does not support custom OAuth scopes.** Its `scopes_supported` is a
 * fixed list — `openid`, `profile`, `email`, `public_metadata`,
 * `private_metadata`, `offline_access` — so `wryte:publish` can neither be
 * registered on the OAuth application nor issued in a token. Clerk's docs say
 * support is "not yet available, but development is underway".
 *
 * So the split is: **the OAuth token proves identity, `users.mcpScopes`
 * decides capability.** The token is still doing the job OAuth is actually
 * good at — short-lived, refreshable, per-client revocable, attributable —
 * and the capability grant lives in Wryte's own settings, which is arguably
 * better UX than a consent screen full of opaque scope strings anyway.
 *
 * What this costs, stated plainly: a grant is per-user, not per-client. Two
 * agents belonging to the same user get the same capabilities, so a leaked
 * token carries whatever that user has enabled. Revocation is still per-client
 * in the Clerk dashboard, and the audit log still names the client. When Clerk
 * ships custom scopes, intersect token scopes with the stored grant rather
 * than replacing it.
 *
 * `read` and `write` are the default grant. The canonical workflow — "read my
 * existing posts, research this topic, draft the first version" — is one user
 * intent that needs both, and an agent that must stop mid-task for a second
 * approval is worse than one scoped correctly up front. Everything with an
 * effect outside Wryte is opt-in.
 */
export const SCOPES = {
  /** Queries: list, get, search, calendar, stats, history. */
  read: "wryte:read",
  /** Create/update documents, research, ideas, snippets, drafts, snapshots. */
  write: "wryte:write",
  /** Commit to GitHub, schedule and cancel scheduled publishes. */
  publish: "wryte:publish",
  /** Upload, list and delete media through the project's provider. */
  media: "wryte:media",
  /**
   * Soft delete only — move a document to the project trash. There is no
   * hard-delete scope because there is no hard-delete tool: `permanentDelete`
   * and `emptyTrash` are excluded from the MCP surface entirely. Anything an
   * agent removes is recoverable from the trash UI.
   */
  trash: "wryte:trash",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/** Every capability, for rendering the settings toggles. */
export const ALL_SCOPES: readonly Scope[] = Object.values(SCOPES);

/**
 * Applied when `users.mcpScopes` is absent. Read + write, so connecting an
 * agent and asking it to draft a post works with no further setup; publish,
 * media and trash stay off until the user turns them on.
 */
export const DEFAULT_GRANT: readonly Scope[] = [SCOPES.read, SCOPES.write];

/** Resolves a stored grant (or its absence) to the effective capability set. */
export function effectiveGrant(stored: string[] | undefined): Set<string> {
  return new Set(stored ?? DEFAULT_GRANT);
}

/**
 * Shape of the `metadata` we attach to every tool declaration. The gateway
 * treats it as opaque and hands it to the authorize callback untouched.
 */
export type WryteToolMetadata = {
  /** Scopes the caller's token must carry. Empty means read-only default. */
  scopes: readonly Scope[];
  /**
   * What the gateway writes into the audit row's `args` column.
   *
   * Omitted → verbatim. `false` → nothing. `{ redact }` → the listed dotted
   * paths replaced with `"[redacted]"`.
   *
   * This is not cosmetic. Convex bills bytes written, and a tool that takes a
   * 50 KB document body would otherwise store that body twice: once in
   * `document_content`, once in the audit log, permanently. Redaction keeps
   * the forensic value (who wrote what, when) without paying for the payload.
   */
  auditArgs?: false | { redact: string[] };
};
