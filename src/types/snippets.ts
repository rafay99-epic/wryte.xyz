import type { Id } from "../../convex/_generated/dataModel";

/**
 * A per-project reusable text snippet. The editor's `/` menu and the settings
 * manager both consume this lightweight shape (full docs carry extra fields we
 * don't need client-side). Stored in the `snippets` table — see convex/schema.ts.
 */
export type Snippet = {
  _id: Id<"snippets">;
  name: string;
  content: string;
};

/**
 * Per-project ABUSE GUARD only — not a real usage limit. The `snippets` table
 * scales to thousands; this just blocks runaway abuse. Mirrored server-side in
 * `convex/cms/snippets.ts` (keep the two in sync).
 */
export const MAX_SNIPPETS = 1000;
/** Max chars in a snippet name — it shows in the `/` menu, so keep it scannable. */
export const MAX_SNIPPET_NAME = 60;
/** Max chars in one snippet's content (~1,300 words); one snippet is one document. */
export const MAX_SNIPPET_CONTENT = 8000;
/** Top matches returned to the `/` menu per search. */
export const SNIPPET_SEARCH_LIMIT = 20;
/** Page size for the paginated settings manager. */
export const SNIPPETS_PAGE_SIZE = 25;
