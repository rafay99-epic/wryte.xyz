export type ContentFormat = "md" | "mdx";

/** Shared with the server so client and GitHub file names always agree. */
export { getFileExtension } from "@wryte/backend/_lib/contentFormat";
