/**
 * Board column CRUD operations for the kanban board.
 *
 * Columns are stored as a JSON string on the project record (`boardColumns`).
 * When no custom columns exist, the client falls back to DEFAULT_BOARD_COLUMNS.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./auth_helpers";

/** Shape of a single board column definition. */
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

/**
 * Returns the board columns for a project.
 * Falls back to DEFAULT_BOARD_COLUMNS when the project has no custom config.
 */
export const getColumns = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return DEFAULT_BOARD_COLUMNS;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

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

/**
 * Saves the full set of board columns for a project.
 * Validates: no duplicate IDs, at most one "publish" and one "schedule" behavior.
 */
export const updateColumns = mutation({
  args: {
    projectId: v.id("projects"),
    columns: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    // Validate the columns JSON
    let columns: BoardColumnDef[];
    try {
      columns = JSON.parse(args.columns);
    } catch {
      throw new Error("Invalid columns JSON");
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error("At least one column is required");
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const col of columns) {
      if (ids.has(col.id)) {
        throw new Error(`Duplicate column ID: "${col.id}"`);
      }
      ids.add(col.id);
    }

    // Check behavior constraints
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

/**
 * Adds a new column to the project's board.
 * Generates a slug-like ID from the label.
 */
export const addColumn = mutation({
  args: {
    projectId: v.id("projects"),
    label: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let columns: BoardColumnDef[] = DEFAULT_BOARD_COLUMNS;
    if (project.boardColumns) {
      try {
        columns = JSON.parse(project.boardColumns);
      } catch {
        // Fall through to defaults
      }
    }

    // Generate a unique ID from the label
    const baseId = args.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    let id = baseId || "column";
    let suffix = 1;
    while (columns.some((c) => c.id === id)) {
      id = `${baseId}-${suffix}`;
      suffix++;
    }

    const maxPosition = Math.max(...columns.map((c) => c.position), -1);

    const newColumn: BoardColumnDef = {
      id,
      label: args.label,
      color: args.color,
      behavior: "none",
      position: maxPosition + 1,
    };

    columns.push(newColumn);

    await ctx.db.patch(args.projectId, {
      boardColumns: JSON.stringify(columns),
      updatedAt: Date.now(),
    });

    return newColumn;
  },
});

/**
 * Removes a column from the project's board.
 * All documents in the removed column are moved to the first column.
 */
export const removeColumn = mutation({
  args: {
    projectId: v.id("projects"),
    columnId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let columns: BoardColumnDef[] = DEFAULT_BOARD_COLUMNS;
    if (project.boardColumns) {
      try {
        columns = JSON.parse(project.boardColumns);
      } catch {
        // Fall through to defaults
      }
    }

    const colIndex = columns.findIndex((c) => c.id === args.columnId);
    if (colIndex === -1) {
      throw new Error(`Column "${args.columnId}" not found`);
    }

    if (columns.length <= 1) {
      throw new Error("Cannot remove the last column");
    }

    // Remove the column
    columns.splice(colIndex, 1);

    // Move all documents in the removed column to the first column
    const firstColumn = columns[0];
    if (!firstColumn) {
      throw new Error("Unexpected empty column list");
    }
    const fallbackStatus = firstColumn.id;
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", args.columnId),
      )
      .collect();

    for (const doc of documents) {
      await ctx.db.patch(doc._id, {
        status: fallbackStatus,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.projectId, {
      boardColumns: JSON.stringify(columns),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reorders columns by updating their position values.
 * Accepts an array of column IDs in the desired order.
 */
export const reorderColumns = mutation({
  args: {
    projectId: v.id("projects"),
    orderedIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let columns: BoardColumnDef[] = DEFAULT_BOARD_COLUMNS;
    if (project.boardColumns) {
      try {
        columns = JSON.parse(project.boardColumns);
      } catch {
        // Fall through to defaults
      }
    }

    // Rebuild columns in the new order
    const reordered: BoardColumnDef[] = [];
    for (let i = 0; i < args.orderedIds.length; i++) {
      const col = columns.find((c) => c.id === args.orderedIds[i]);
      if (col) {
        reordered.push({ ...col, position: i });
      }
    }

    // Add any columns not in the ordered list (shouldn't happen, but safety)
    for (const col of columns) {
      if (!args.orderedIds.includes(col.id)) {
        reordered.push({ ...col, position: reordered.length });
      }
    }

    await ctx.db.patch(args.projectId, {
      boardColumns: JSON.stringify(reordered),
      updatedAt: Date.now(),
    });
  },
});
