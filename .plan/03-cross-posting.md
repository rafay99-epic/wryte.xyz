# Cross-Posting (dev.to, Hashnode)

"Write Now, Publish Later" → "publish everywhere": syndicate a published post
to dev.to and Hashnode from the same publish flow, with canonical URLs
pointing back at the primary site.

## Data model

- `crosspost_targets` table: per-project connection — platform
  (`"devto" | "hashnode"`), Vault secret id for the API key (reuse the
  `secretStore` interface in `convex/integrations/secretStore.ts` — same
  pattern as AI credentials), default flags (publish as draft?, canonical on).
- `crossposts` table: per document × platform — remote id/url, status
  (`pending | published | failed`), lastSyncedAt, error. Indexed
  `by_documentId`.

## Flow

1. **Settings → Integrations:** add/connect a platform (API key → Vault,
   verify with a cheap `GET /user` call in a Node action).
2. **Publish dialog:** a "Syndicate" section listing connected platforms with
   checkboxes (defaults from the target row). On publish (or after a
   scheduled publish fires), enqueue one workpool action per selected
   platform — reuse the existing `@convex-dev/workpool` pools, don't create
   a new one.
3. **Markdown adaptation per platform** (pure function, unit-testable):
   frontmatter → platform fields (title, tags ≤4 for dev.to, canonical_url),
   strip/convert wiki-links to absolute URLs, rewrite relative image paths.
4. **Re-publish = update**, not duplicate: if a `crossposts` row exists, call
   the platform's update endpoint with the stored remote id.

## Cost profile

- Zero recurring cost: actions run only at publish/update time. Status reads
  ride the existing document subscription (denormalize a tiny
  `crosspostSummary` onto the document row only if the dialog needs it live;
  otherwise fetch on dialog open).

## Risks / edge cases

- Rate limits (dev.to: 30 req/30s) — workpool retry with backoff, never fail
  the primary publish because syndication failed (status row records the
  error, dialog shows a retry button).
- MDX components don't render on those platforms — the adapter must strip
  custom components and warn in the publish checklist when it does.
- Canonical URL requires the published site URL — read from project settings
  (GitHub sync config already knows the site mapping).

## Verification

- Unit tests for the markdown adapter (fixtures per platform).
- e2e with a mocked platform API (route the action's fetch through an env-var
  base URL so Playwright can point it at a local stub).
