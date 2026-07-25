/**
 * Backfill for `users.clerkUserId`.
 *
 * ## Why this is needed
 *
 * MCP callers are resolved by Clerk subject (`requireCaller` in `_lib/auth.ts`
 * queries `by_clerkUserId`), because a component-dispatched tool has no
 * `ctx.auth` and the gateway hands us only `{ subject }`. Rows created before
 * `clerkUserId` was added carry `undefined`, and the field is only populated
 * lazily — `getCurrentUser` patches it on the next *mutation*, and
 * `users.getOrCreate` on the next sign-in.
 *
 * So an older account that has only ever been read from has a null
 * `clerkUserId`, and every MCP tool fails with "No Wryte account for this
 * identity" even though the account plainly exists. Waiting for the lazy path is
 * not good enough when a user's first authenticated action is over MCP.
 *
 * The value is derived from `tokenIdentifier` (`<issuer>|<clerk-user-id>`), which
 * Convex writes from the verified JWT — so this reads trusted data and invents
 * nothing.
 *
 * Idempotent: rows that already have the field are skipped, so re-running is
 * free.
 *
 * Run it from **Admin → MCP backfill** in the app. `run` is admin-gated on the
 * Clerk role, so `convex run mcp/backfill:run` fails with "Not authenticated" —
 * the CLI has deployment credentials but no Clerk identity. To drive it from a
 * terminal, page through the internal mutation instead:
 *
 *     bunx convex run mcp/backfill:_page '{"cursor":null}'
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { parseClerkUserId } from "../_lib/auth";

/** Rows scanned per mutation. Well inside the 16k-writes / 16 MiB envelope. */
const BATCH = 200;

/** Safety stop so a bug can't spin forever. 200 pages = 40k users. */
const MAX_PAGES = 200;

/**
 * Explicit type for the page result.
 *
 * Needed because `run` below calls `internal.mcp.backfill._page` from this same
 * module: Convex's codegen types `api`/`internal` from every file, so this file
 * depends on `internal` which depends on this file. Without an annotation
 * TypeScript can't resolve the local and falls back to `any`. Same reason
 * `mcp/tools.ts` annotates its exported catalog.
 */
type PageResult = {
  scanned: number;
  patched: number;
  unparseable: number;
  cursor: string | null;
};

const pageResult = v.object({
  scanned: v.number(),
  patched: v.number(),
  unparseable: v.number(),
  cursor: v.union(v.string(), v.null()),
});

/**
 * One page of the backfill. Returns the next cursor rather than rescheduling
 * itself, so the caller controls the loop and can report totals — a self-driving
 * version can't tell the UI when it finished.
 */
export const _page = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: pageResult,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("users")
      .paginate({ numItems: BATCH, cursor: args.cursor });

    let patched = 0;
    let unparseable = 0;
    for (const user of page.page) {
      if (user.clerkUserId) continue;
      const clerkUserId = parseClerkUserId(user.tokenIdentifier);
      if (!clerkUserId) {
        // Not a Clerk-issued identity, or an issuer format we don't recognise.
        // Reported rather than guessed at — a wrong value here would hand one
        // user's agent access to another user's account.
        console.warn(
          `[mcp/backfill] could not parse a Clerk user id from user ${user._id}; skipped`,
        );
        unparseable++;
        continue;
      }
      await ctx.db.patch(user._id, { clerkUserId });
      patched++;
    }

    return {
      scanned: page.page.length,
      patched,
      unparseable,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});

/**
 * Admin entry point. Drains every page and returns the totals so the UI can show
 * what actually happened.
 */
export const run = action({
  args: {},
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    unparseable: v.number(),
    pages: v.number(),
    complete: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    let cursor: string | null = null;
    let scanned = 0;
    let patched = 0;
    let unparseable = 0;
    let pages = 0;

    for (; pages < MAX_PAGES; pages++) {
      const page: PageResult = await ctx.runMutation(
        internal.mcp.backfill._page,
        { cursor },
      );
      scanned += page.scanned;
      patched += page.patched;
      unparseable += page.unparseable;
      cursor = page.cursor;
      if (cursor === null) {
        return {
          scanned,
          patched,
          unparseable,
          pages: pages + 1,
          complete: true,
        };
      }
    }

    // Hit the page ceiling with rows left. Re-running picks up where this left
    // off, because already-patched rows are skipped.
    console.warn(
      `[mcp/backfill] stopped at the ${String(MAX_PAGES)}-page ceiling; re-run to continue`,
    );
    return { scanned, patched, unparseable, pages, complete: false };
  },
});
