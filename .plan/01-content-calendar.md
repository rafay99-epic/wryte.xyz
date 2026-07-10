# Content Calendar

## Status: shipped (pre-existing feature, completed 2026-07-10)

**Discovery:** a full calendar already existed at
`/projects/[projectId]/calendar` (`src/features/calendar/`) — month grid,
timezone-aware drag-to-reschedule (instant when the time of day stays valid,
time popover otherwise), unscheduled side panel with search + status filters,
published-docs locked. It was linked from the sidebar but invisible from the
articles dashboard where table/board live, had no way to *cancel* a schedule
by drag, and had zero e2e coverage.

## Gap work done (2026-07-10)

1. **Calendar as a third dashboard view mode.** `DashboardViewMode` is now
   `table | board | calendar` (persisted per project in
   `wryte:view:{projectId}`); the `ViewModeSwitcher` gained a calendar button
   and the `⌘⇧L`-style layout shortcut cycles all three. The calendar renders
   via a new shared `CalendarSurface` (also used by the standalone route —
   no duplicated data-fetching).
2. **Drag-to-unschedule.** The unscheduled panel (open or collapsed) is a
   drop zone: dropping a scheduled article on it calls
   `integrations.scheduling.cancel`, reverting it to draft. Highlight only
   when the dragged doc is actually scheduled.
3. **Cost discipline preserved:** `listForCalendar` (metadata-only, take 500)
   + board columns subscribe ONLY while the calendar is on screen — mounting
   is the gate, so table/board users pay nothing new.
4. **a11y/e2e hooks:** aria-labels on month nav + view-mode buttons,
   `data-testid="calendar-surface"`; new self-cleaning Playwright spec.

## Architecture reference

- Data: `documents.listForCalendar({ projectId })` →
  `_id,title,slug,status,scheduledAt,publishedAt,updatedAt,createdAt`.
- Mutations: `integrations.scheduling.schedule({ documentId, scheduledAt })`
  (idempotent reschedule), `scheduling.cancel({ documentId })`.
- Grid groups by `formatLocalDate(ts, projectTimezone)`; scheduled docs use
  `scheduledAt`, published use `publishedAt`; drafts/review/ready live in the
  unscheduled panel.
- Status colors come from the board column config (`board-colors.ts`).

## Future ideas (not scheduled)

- Week view / density toggle for busy calendars.
- Read-only ICS feed per project (signed URL, no polling cost until fetched).
- Publish-cadence overlay (target N posts/week, show gaps).
- Month-window-bounded query if projects ever exceed ~500 docs.
