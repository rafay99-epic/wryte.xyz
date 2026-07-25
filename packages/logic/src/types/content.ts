/** Unified content row type shared between table and board views. */
export type ContentItem = {
  kind: "local" | "remote";
  id?: string;
  title: string;
  slug: string;
  path: string;
  status?: string;
  synced: boolean;
  needsSync?: boolean | undefined;
  excerpt: string;
  updatedAt?: number;
  size?: number;
  sha?: string;
  tags?: string[];
  boardPosition?: number;
  wordCount?: number;
};
