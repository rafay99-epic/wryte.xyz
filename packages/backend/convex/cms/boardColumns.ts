import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

interface BoardColumnDef {
  id: string;
  label: string;
  color: string;
  behavior: "none" | "schedule" | "publish";
  position: number;
}

const DEFAULT_BOARD_COLUMNS: BoardColumnDef[] = [
  { id: "draft", label: "Draft", color: "gray", behavior: "none", position: 0 },
  {
    id: "review",
    label: "Review",
    color: "amber",
    behavior: "none",
    position: 1,
  },
  {
    id: "ready",
    label: "Ready",
    color: "blue",
    behavior: "none",
    position: 2,
  },
  {
    id: "scheduled",
    label: "Scheduled",
    color: "purple",
    behavior: "schedule",
    position: 3,
  },
  {
    id: "published",
    label: "Published",
    color: "emerald",
    behavior: "publish",
    position: 4,
  },
];

export const getColumns = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      return DEFAULT_BOARD_COLUMNS;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return DEFAULT_BOARD_COLUMNS;
    }

    if (!project.boardColumns) {
      return DEFAULT_BOARD_COLUMNS;
    }

    try {
      const columns = JSON.parse(project.boardColumns) as BoardColumnDef[];
      return columns.sort((a, b) => a.position - b.position);
    } catch {
      return DEFAULT_BOARD_COLUMNS;
    }
  },
});

export const updateColumns = mutation({
  args: {
    projectId: v.id("projects"),
    columns: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "boardColumns:updateColumns", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let columns: BoardColumnDef[];
    try {
      columns = JSON.parse(args.columns);
    } catch {
      throw new Error("Invalid columns JSON");
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error("At least one column is required");
    }

    const ids = new Set<string>();
    for (const col of columns) {
      if (ids.has(col.id)) {
        throw new Error(`Duplicate column ID: "${col.id}"`);
      }
      ids.add(col.id);
    }

    const publishCount = columns.filter((c) => c.behavior === "publish").length;
    const scheduleCount = columns.filter(
      (c) => c.behavior === "schedule",
    ).length;

    if (publishCount > 1) {
      throw new Error("At most one column can have the 'publish' behavior");
    }
    if (scheduleCount > 1) {
      throw new Error("At most one column can have the 'schedule' behavior");
    }

    await ctx.db.patch(args.projectId, {
      boardColumns: args.columns,
      updatedAt: Date.now(),
    });
  },
});
