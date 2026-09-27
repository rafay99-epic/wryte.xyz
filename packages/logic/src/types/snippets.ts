import type { Id } from "@wryte/backend/_generated/dataModel";

export type Snippet = {
  _id: Id<"snippets">;
  name: string;
  content: string;
};

export const MAX_SNIPPETS = 1000;
export const MAX_SNIPPET_NAME = 60;
export const MAX_SNIPPET_CONTENT = 8000;
export const SNIPPET_SEARCH_LIMIT = 20;
export const SNIPPETS_PAGE_SIZE = 25;
