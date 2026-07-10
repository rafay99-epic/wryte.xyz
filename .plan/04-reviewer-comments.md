# Reviewer Comments on Share Links

Let a reader of a share link leave inline comments — no account required.
The cheapest real taste of collaboration, and the one place Convex's
reactivity is a visible wow (comments appear live while the author watches).

## Data model

- `share_comments` table: shareLinkId, documentId, projectId (denormalized
  for cascade), anchor (`{ start, end, quotedText }` against the shared
  snapshot's content), body (length-capped ~2000 chars), authorName
  (free-text, length-capped), createdAt, resolvedAt?. Indexed
  `by_shareLinkId` and `by_documentId_unresolved` (mirroring the
  sync-conflicts index pattern).
- Comments anchor to the **content snapshot the share link serves** (share
  links already pin content) — so author edits never orphan an anchor;
  quotedText is the fallback render if positions drift after re-share.

## Flow

- **Reader (unauthenticated):** select text on the shared page → "Comment"
  popover (reuse the selection-toolbar interaction pattern from
  `selection-toolbar.tsx`) → name + comment. Public mutation guarded by:
  share link exists + not revoked + comments enabled on the link +
  rate limit (per-IP-ish key via the existing rateLimiter, strict — e.g.
  10/hour) + length caps. NO auth bypass anywhere else: the mutation only
  ever writes `share_comments`, reads nothing private.
- **Author:** a comments rail in the editor (flat list, grouped
  resolved/unresolved), click → scroll to the quoted text (find-by-string,
  like the readability lens excerpts). Resolve/delete actions. A count badge
  on the share-link dialog.
- **Live updates:** the shared page subscribes to `by_shareLinkId` (bounded,
  only while open); the author's rail subscribes only while the rail is open.

## Cost profile

- No always-on subscriptions. The editor gains zero hot-path reads —
  the rail is lazy, like the research panel.

## Abuse surface (design it in from day one)

- Rate limit + max comments per link (e.g. 200, drop oldest-unresolved
  never — just reject with a friendly error).
- Author can disable comments per link and purge all comments on revoke
  (cascade delete with the link).
- No HTML rendering of comment bodies — plain text only.

## Verification

- e2e: create share link (comments on) → open unauthenticated context →
  select text → comment → author sees it live in the rail → resolve →
  revoke link → comments gone. Self-cleaning.
