# Wryte — Feature Roadmap

Chosen direction (2026-07-10): four features that multiply existing
infrastructure rather than adding new subsystems. Ordered by build sequence.

| # | Feature | Status | Leverage | Convex cost profile |
|---|---------|--------|----------|---------------------|
| 1 | [Content calendar](./01-content-calendar.md) | **In progress** | Scheduled publishing, statuses, dnd-kit board patterns | ~free — one bounded query per month view |
| 2 | [SEO & link intelligence](./02-seo-link-intelligence.md) | Planned | Frontmatter editor, `document_links` graph, readability-lens UI patterns | Mostly client-side; graph reads bounded |
| 3 | [Cross-posting](./03-cross-posting.md) | Planned | Publish dialog, GitHub sync patterns, Vault credential storage | Actions only at publish time |
| 4 | [Reviewer comments on share links](./04-reviewer-comments.md) | Planned | Share links, Convex reactivity | One subscription while a shared page is open |

## Shared principles

- **Performance & reliability first** (per AGENTS.md): no chatty polling, no
  unbounded queries, hot paths never grow reads.
- **Function-budget aware**: every plan states its read/write cost explicitly.
- **Flat UI** (no nested card-on-card), framer-motion for transitions,
  view-mode patterns consistent with the existing table/board toggle.
- Every feature ships with at least one self-cleaning Playwright spec.

## Explicitly deferred

- **Multi-user collaboration** — every Convex function assumes single-owner
  (`userId ===` checks throughout). Real collaborators = a dedicated project
  touching all ownership checks. Do not squeeze in sideways.
- **`cacheComponents: true`** (Next 16 caching model) — tracked in PR #30's
  notes, separate follow-up.
