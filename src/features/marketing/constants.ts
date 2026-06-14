/**
 * Data for the v2 ("diff hero + product canvas") landing page.
 *
 * Kept separate from `features/marketing/constants.ts` so the redesign can
 * live alongside the current landing page without touching it. When v2 ships,
 * this can be promoted/merged.
 */

/* ── Hero: animated unified diff ───────────────────────────────────────── */

export type DiffLine = {
  /** Diff kind drives the gutter sign + color. */
  kind: "context" | "remove" | "add" | "meta";
  text: string;
};

/**
 * The hero diff tells the core story in one glance: the old multi-tool dance
 * (red) collapses into a single clean Wryte commit (green).
 */
export const heroDiffLines: DiffLine[] = [
  { kind: "meta", text: "content/posts/shipping-faster.md" },
  { kind: "context", text: "---" },
  { kind: "context", text: 'title: "Shipping Faster with Wryte"' },
  { kind: "remove", text: "status: draft        # stuck in a CMS database" },
  { kind: "remove", text: "exported_at: null    # waiting on a webhook" },
  { kind: "add", text: "date: 2026-04-07" },
  { kind: "add", text: "tags: [devtools, workflow]" },
  { kind: "add", text: "draft: false" },
  { kind: "context", text: "---" },
  { kind: "context", text: "" },
  {
    kind: "remove",
    text: "# Copy-paste from another tool, then commit by hand",
  },
  { kind: "add", text: "# Write here. Publish. It's already a commit." },
];

/* ── Commit ticker (marquee replacement) ───────────────────────────────── */

export const commitTicker: { hash: string; msg: string }[] = [
  { hash: "a3f8b2c", msg: "feat: add getting-started guide" },
  { hash: "9d41e07", msg: "content: refresh api-reference" },
  { hash: "1f6c5a9", msg: "post: shipping faster with wryte" },
  { hash: "7b20de4", msg: "fix: frontmatter date format" },
  { hash: "c4e9f13", msg: "chore: schedule v0.20 changelog" },
  { hash: "e81a6d2", msg: "post: the developer content problem" },
  { hash: "5a7c0b8", msg: "content: bulk-publish 4 drafts" },
  { hash: "2db93f1", msg: "feat: tag taxonomy cleanup" },
];

/* ── Connected flow: how the pieces actually work together ─────────────── */

export type FlowNode = {
  id: string;
  label: string;
  sub: string;
  /** Tailwind text-color class for the accent. */
  color: string;
  dot: string;
  glow: string;
};

export const flowNodes: FlowNode[] = [
  {
    id: "editor",
    label: "Editor",
    sub: "Markdown + live preview. Auto-save on every keystroke.",
    color: "text-amber-400",
    dot: "bg-amber-400",
    glow: "bg-amber-400/20",
  },
  {
    id: "board",
    label: "Board",
    sub: "Kanban columns track status. Drag, tag, schedule.",
    color: "text-purple-400",
    dot: "bg-purple-400",
    glow: "bg-purple-400/20",
  },
  {
    id: "engine",
    label: "Publish engine",
    sub: "Durable scheduling, diff-before-sync, conflict detection.",
    color: "text-blue-400",
    dot: "bg-blue-400",
    glow: "bg-blue-400/20",
  },
  {
    id: "repo",
    label: "Your GitHub repo",
    sub: "The single source of truth. Real markdown, clean commits.",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    glow: "bg-emerald-400/20",
  },
];

/* ── Comparison: the "git dance" diff narrative ────────────────────────── */

export const oldWaySteps: string[] = [
  "Write in a proprietary editor",
  "Content lives in their database",
  "Export, or call an API at build time",
  "Wire up a webhook — and hope it fires",
  "Debug why production is out of sync",
];

export const wryteWaySteps: string[] = [
  "Write markdown in a real editor",
  "Organize on a board, schedule if you like",
  "Click publish",
  "git commit → your repo",
  "Your existing CI deploys. Done.",
];

/* ── Comparison matrix ─────────────────────────────────────────────────── */

export type Cell = {
  /** Visual verdict drives the icon + tint. */
  verdict: "yes" | "no" | "partial";
  /** Short qualifier shown under the icon. */
  note: string;
};

export type ComparisonRow = {
  capability: string;
  /** Columns in this fixed order: payload, tina, sanity, contentful, wryte */
  payload: Cell;
  tina: Cell;
  sanity: Cell;
  contentful: Cell;
  wryte: Cell;
};

export const comparisonColumns = [
  { key: "payload", label: "Payload" },
  { key: "tina", label: "TinaCMS" },
  { key: "sanity", label: "Sanity" },
  { key: "contentful", label: "Contentful" },
  { key: "wryte", label: "Wryte", highlight: true },
] as const;

export const comparisonRows: ComparisonRow[] = [
  {
    capability: "Source of truth",
    payload: { verdict: "no", note: "Its own database" },
    tina: { verdict: "yes", note: "Your git repo" },
    sanity: { verdict: "no", note: "Hosted dataset" },
    contentful: { verdict: "no", note: "Hosted cloud" },
    wryte: { verdict: "yes", note: "Your GitHub repo" },
  },
  {
    capability: "Content stored as",
    payload: { verdict: "no", note: "DB rows" },
    tina: { verdict: "yes", note: "Markdown / MDX" },
    sanity: { verdict: "no", note: "Proprietary docs" },
    contentful: { verdict: "no", note: "Proprietary entries" },
    wryte: { verdict: "yes", note: "Plain .md files" },
  },
  {
    capability: "Git-native workflow",
    payload: { verdict: "no", note: "None — export first" },
    tina: { verdict: "partial", note: "Tied to its config" },
    sanity: { verdict: "no", note: "None" },
    contentful: { verdict: "no", note: "None" },
    wryte: { verdict: "yes", note: "Every change is a commit" },
  },
  {
    capability: "Infra to run",
    payload: { verdict: "no", note: "DB + app to host" },
    tina: { verdict: "partial", note: "Self-host or Tina Cloud" },
    sanity: { verdict: "partial", note: "Hosted SaaS" },
    contentful: { verdict: "partial", note: "Hosted SaaS" },
    wryte: { verdict: "yes", note: "Zero — commits to your repo" },
  },
  {
    capability: "Works with any repo",
    payload: { verdict: "no", note: "Build around its schema" },
    tina: { verdict: "partial", note: "Wrap your site in Tina" },
    sanity: { verdict: "no", note: "Fetch via GROQ/API" },
    contentful: { verdict: "no", note: "Fetch via API" },
    wryte: { verdict: "yes", note: "Point it at a repo + path" },
  },
  {
    capability: "Editorial kanban board",
    payload: { verdict: "no", note: "—" },
    tina: { verdict: "no", note: "—" },
    sanity: { verdict: "no", note: "—" },
    contentful: { verdict: "partial", note: "Enterprise add-on" },
    wryte: { verdict: "yes", note: "Built in" },
  },
  {
    capability: "Scheduled publishing",
    payload: { verdict: "partial", note: "Custom / plugin" },
    tina: { verdict: "no", note: "Roll your own" },
    sanity: { verdict: "partial", note: "Add-on" },
    contentful: { verdict: "yes", note: "Native" },
    wryte: { verdict: "yes", note: "Durable cron + retries" },
  },
  {
    capability: "AI assistance (BYO keys)",
    payload: { verdict: "no", note: "—" },
    tina: { verdict: "no", note: "—" },
    sanity: { verdict: "partial", note: "Paid add-on" },
    contentful: { verdict: "partial", note: "Paid tier" },
    wryte: { verdict: "yes", note: "BYOK, never proxied" },
  },
  {
    capability: "Vendor lock-in",
    payload: { verdict: "partial", note: "Your DB, OSS app" },
    tina: { verdict: "partial", note: "Low–medium" },
    sanity: { verdict: "no", note: "High" },
    contentful: { verdict: "no", note: "High" },
    wryte: { verdict: "yes", note: "None — your repo, your keys" },
  },
];
