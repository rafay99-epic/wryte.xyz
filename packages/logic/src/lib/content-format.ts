export type ContentFormat = "md" | "mdx";

export function getFileExtension(format?: ContentFormat | string): string {
  return format === "mdx" ? ".mdx" : ".md";
}
