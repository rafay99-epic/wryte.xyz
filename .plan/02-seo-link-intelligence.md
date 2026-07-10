# SEO & Link Intelligence

## Status: shipped 2026-07-10 (all three pieces)

Implementation notes vs. the original plan below:
- **A** shipped as `FrontmatterSearchPreview` (collapsible section at the
  bottom of the frontmatter panel; canvas-based pixel checks in
  `lib/seo-preview.ts`; uses `project.siteUrl` + live `values`).
- **B** shipped as a "Link suggestions" section in the research panel
  (`use-link-suggestions.ts` + pure scanner in `lib/link-suggestions.ts`;
  ONE one-shot metadata query per panel-open — reuses `listForCalendar` —
  debounced client-side scanning; "Link it" wraps the mention via
  `replaceRange` and highlights it).
- **C** shipped WITHOUT the cron: `documents.listStale` is a bounded
  `by_projectId_and_status` read (published, take 500, filter updatedAt,
  top 10) subscribed only while the project overview is open — zero
  standing cost, simpler than the cron+table design. Revisit the cron only
  if projects outgrow the bounded read.

Close the discoverability loop: the readability lens covers prose quality;
nothing yet covers how a post *performs* once published.

## Three independent pieces (ship separately, in this order)

### A. Serp/social card preview (pure client-side — zero backend cost)

- Live Google result + Open Graph + Twitter/X card preview rendered from the
  frontmatter editor's current values (title, description, ogImage, slug).
- Pixel-truncation warnings: title >600px, description >920px (Google), plus
  the OG image aspect check (1.91:1).
- **Where:** a collapsible section inside `FrontmatterEditor`
  (`src/features/editor/components/frontmatter-editor.tsx`), same flat style
  as the frontmatter validation block. No new queries — it reads state the
  editor already holds.

### B. Internal-link suggestions (bounded graph reads)

- "You mention *X* here — link it": scan the draft body (client-side, same
  masking approach as `style-lint.ts`: skip code blocks/frontmatter/URLs) for
  title/alias matches against the project's documents, excluding targets
  already linked (the `document_links` table already stores resolved edges).
- Surface in the research panel next to the existing "Linked from" backlinks
  section — same list UI, one *Insert link* action per suggestion that wraps
  the first occurrence in `[[...]]` via the editor's `replaceRange`.
- **Cost:** one bounded metadata query for the project's document titles
  (already exists for the wiki-link menu — reuse it), plus the backlinks
  query the panel already makes. No new subscriptions.

### C. Stale-content radar (daily cron, self-draining)

- Dashboard section: published posts not updated in N months (default 6),
  sorted by staleness; each row deep-links into the editor.
- **Cost discipline:** do NOT scan on page load. A daily cron computes the
  stale list into a small `project_health` row (one per project); the
  dashboard reads that single row. Aligns with the existing
  daily/self-draining cron preference.
- Later hook: when the analytics loop lands (Vercel Analytics pull), merge
  "declining views" into the same radar row.

## Non-goals

- Keyword research / SERP scraping (external APIs, cost + flakiness).
- Auto-linking without user confirmation (never mutate content silently).

## Verification

- Unit-style checks for the pixel-truncation math and the suggestion matcher
  (masking edge cases), one e2e: set frontmatter → preview updates; suggestion
  appears for a seeded title mention → insert → becomes a `[[link]]`.
