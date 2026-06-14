import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/**
 * Admin migration: drains every document's legacy inline `content` into the
 * dedicated `document_content` table (see the schema comment on
 * `documents.content`). This is the data migration paired with the
 * body-split refactor — until it runs, the hot list/board queries still pay
 * to read inline bodies on un-migrated rows via the helper fallback.
 *
 * Drives `_backfillDocumentContent` chunk-by-chunk to completion so the UI
 * gets an accurate final count rather than "continuation scheduled".
 * Idempotent — already-migrated rows (no inline content) are skipped, so a
 * re-run after hitting the per-invocation chunk cap simply resumes.
 */
const MAX_CHUNKS = 1000; // 25 docs/chunk → up to 25k documents per invocation

export const migrateDocumentContent = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "seed:run", { key, throws: true });
    await requireAdmin(ctx);

    let cursor: string | null = null;
    let migrated = 0;
    let scanned = 0;
    let chunks = 0;
    let isDone = false;

    while (chunks < MAX_CHUNKS) {
      const res: {
        migrated: number;
        scanned: number;
        isDone: boolean;
        cursor: string | null;
      } = await ctx.runMutation(
        internal.cms.documents._backfillDocumentContent,
        { cursor },
      );
      migrated += res.migrated;
      scanned += res.scanned;
      chunks += 1;
      if (res.isDone) {
        isDone = true;
        break;
      }
      cursor = res.cursor;
    }

    const bodies = `${String(migrated)} ${migrated === 1 ? "body" : "bodies"}`;
    return {
      status: "ok",
      details: isDone
        ? `Migrated ${bodies} into document_content (${String(scanned)} documents scanned). Complete.`
        : `Migrated ${bodies} so far (${String(scanned)} scanned); more documents remain — run again to continue.`,
    };
  },
});
