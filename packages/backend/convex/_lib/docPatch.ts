import type { Doc, TableNames } from "../_generated/dataModel";

/**
 * The value `ctx.db.patch` accepts for a table: every non-system field is
 * optional, and optional fields also accept `undefined` (to unset them) under
 * `exactOptionalPropertyTypes`. Mirrors Convex's non-exported `PatchValue`.
 * Use it to type patch objects built up field by field before the write.
 */
export type DocPatch<T extends TableNames> = {
  [K in Exclude<
    keyof Doc<T>,
    "_id" | "_creationTime"
  >]?: undefined extends Doc<T>[K] ? Doc<T>[K] | undefined : Doc<T>[K];
};
