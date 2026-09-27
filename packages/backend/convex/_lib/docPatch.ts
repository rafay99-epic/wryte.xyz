import type { Doc, TableNames } from "../_generated/dataModel";

export type DocPatch<T extends TableNames> = {
  [K in Exclude<
    keyof Doc<T>,
    "_id" | "_creationTime"
  >]?: undefined extends Doc<T>[K] ? Doc<T>[K] | undefined : Doc<T>[K];
};
