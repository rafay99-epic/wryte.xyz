import { v } from "convex/values";

export const contentFormatValidator = v.union(
  v.literal("md"),
  v.literal("mdx"),
);

export function getFileExtension(contentFormat?: string): string {
  return contentFormat === "mdx" ? ".mdx" : ".md";
}
